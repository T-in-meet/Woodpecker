import { AI_RUN_STATUS } from "@/features/ai/chats/constants";
import type { AiTokenUsage } from "@/features/ai/providers/types";
import { estimateAiUsageCostUsd } from "@/features/ai/usage/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/db.helpers";

/** Note Chat Run 갱신 단계입니다. */
export const NOTE_CHAT_RUN_UPDATE_STEP = {
  ANSWER_GENERATION: "answer_generation",
  EXPANDED_QUERY: "expanded_query",
  QUERY_EMBEDDING: "query_embedding",
  QUERY_EXPANSION: "query_expansion",
  SOURCES: "sources",
} as const;

/** Note Chat Run 갱신 단계 타입입니다. */
export type NoteChatRunUpdateStep =
  (typeof NOTE_CHAT_RUN_UPDATE_STEP)[keyof typeof NOTE_CHAT_RUN_UPDATE_STEP];

/** Run 저장에 필요한 Supabase Admin Client 최소 형태입니다. */
type NoteChatRunPersistenceClient = Pick<
  ReturnType<typeof createAdminClient>,
  "from"
>;

/** 노트 챗봇 Run 기록 생성 입력입니다. */
export type CreateNoteChatRunRecordParams = {
  /** 실행을 발생시킨 User Message ID입니다. */
  userMessageId: string;

  /** Answer Generation Agent ID입니다. */
  agentId: string;

  /** Answer Generation Prompt Version ID입니다. */
  promptVersionId: string;

  /** Answer Generation Chat Model Config ID입니다. */
  chatModelConfigId: string;

  /** Query Embedding Model Config ID입니다. */
  embeddingModelConfigId: string;
};

/** 노트 챗봇 Run 성공 완료 입력입니다. */
export type CompleteNoteChatRunSuccessParams = {
  /** 완료할 Run ID입니다. */
  runId: string;

  /** 생성된 Assistant Message ID입니다. */
  assistantMessageId: string;

  /** 실행에 사용된 Context 출처 Snapshot입니다. */
  sources: Json[];
};

/** 노트 챗봇 Run 실패 완료 입력입니다. */
export type CompleteNoteChatRunFailureParams = {
  /** 실패 처리할 Run ID입니다. */
  runId: string;

  /** 실패 원인 메시지입니다. */
  failureMessage: string;
};

/** 문맥 기반 질의 확장 결과 저장 입력입니다. */
export type SaveNoteChatExpandedQueryParams = {
  /** 확장 질의를 생성한 Run ID입니다. */
  runId: string;

  /** 노트 검색에 사용할 문맥 기반 확장 질의입니다. */
  expandedQuery: string;
};

/** Note Chat Source Snapshot 저장 입력입니다. */
export type SaveNoteChatRunSourcesParams = {
  /** 갱신할 Run ID입니다. */
  runId: string;

  /** 실행에 사용된 Context 출처 Snapshot입니다. */
  sources: Json[];
};

/** Note Chat Query Expansion usage 저장 입력입니다. */
export type SaveNoteChatRunQueryExpansionParams = {
  /** 갱신할 Run ID입니다. */
  runId: string;

  /** Query Expansion Provider usage입니다. */
  usage: AiTokenUsage;

  /** 비용 추정에 사용할 model key입니다. */
  modelKey: string;
};

/** Note Chat Query Embedding usage 저장 입력입니다. */
export type SaveNoteChatRunQueryEmbeddingParams = {
  /** 갱신할 Run ID입니다. */
  runId: string;

  /** Query Embedding Provider usage입니다. */
  usage: AiTokenUsage;

  /** 비용 추정에 사용할 model key입니다. */
  modelKey: string;
};

/** Note Chat Answer Generation usage 저장 입력입니다. */
export type SaveNoteChatRunAnswerGenerationParams = {
  /** 갱신할 Run ID입니다. */
  runId: string;

  /** Answer Generation Provider usage입니다. */
  usage: AiTokenUsage;

  /** 비용 추정에 사용할 model key입니다. */
  modelKey: string;
};

/**
 * 노트 챗봇 Run 기록을 running 상태로 생성합니다.
 *
 * 이 함수는 실행 관측/감사를 위한 record insert만 담당합니다.
 * conversation in-flight, 중복 실행 방지, 일일 제한은 execution claim 계층에서
 * 처리합니다.
 *
 * @param params Run 기록 생성에 필요한 User Message 및 Runtime snapshot
 * @param options 테스트에서 주입할 Supabase Client
 * @returns 생성된 Run 기록 ID
 */
export async function createNoteChatRunRecord(
  params: CreateNoteChatRunRecordParams,
  options: {
    supabase?: NoteChatRunPersistenceClient | undefined;
  } = {},
): Promise<string> {
  const supabase = options.supabase ?? createAdminClient();
  const startedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("note_chat_runs")
    .insert({
      agent_id: params.agentId,
      chat_model_config_id: params.chatModelConfigId,
      embedding_model_config_id: params.embeddingModelConfigId,
      prompt_version_id: params.promptVersionId,
      started_at: startedAt,
      status: AI_RUN_STATUS.RUNNING,
      user_message_id: params.userMessageId,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to create note chat run record: ${error.message}`);
  }

  if (!data) {
    throw new Error("Note chat run record insert returned no row.");
  }

  return data.id;
}

/**
 * Query Expansion Provider usage와 비용을 Run에 저장합니다.
 *
 * Provider 호출 직후 usage를 저장하여 이후 응답 파싱이나 검증이 실패해도
 * 이미 발생한 Query Expansion 사용량과 비용을 보존합니다.
 *
 * @param params Query Expansion Provider usage
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function saveNoteChatRunQueryExpansion(
  params: SaveNoteChatRunQueryExpansionParams,
  options: {
    supabase?: NoteChatRunPersistenceClient | undefined;
  } = {},
): Promise<void> {
  const cost = estimateAiUsageCostUsd({
    modelKey: params.modelKey,
    usage: params.usage,
  });

  await updateRunningRun(
    params.runId,
    {
      query_expansion_cost_usd: cost.totalCostUsd,
      query_expansion_usage: createTokenUsageJson(params.usage),
    },
    options,
  );
}

/**
 * Query Embedding Provider usage와 비용을 Run에 저장합니다.
 *
 * @param params Query Embedding Provider usage
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function saveNoteChatRunQueryEmbedding(
  params: SaveNoteChatRunQueryEmbeddingParams,
  options: {
    supabase?: NoteChatRunPersistenceClient | undefined;
  } = {},
): Promise<void> {
  const cost = estimateAiUsageCostUsd({
    modelKey: params.modelKey,
    usage: params.usage,
  });

  await updateRunningRun(
    params.runId,
    {
      query_embedding_cost_usd: cost.totalCostUsd,
      query_embedding_usage: createTokenUsageJson(params.usage),
    },
    options,
  );
}

/**
 * Answer Generation Provider usage와 비용을 Run에 저장합니다.
 *
 * @param params Answer Generation Provider usage
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function saveNoteChatRunAnswerGeneration(
  params: SaveNoteChatRunAnswerGenerationParams,
  options: {
    supabase?: NoteChatRunPersistenceClient | undefined;
  } = {},
): Promise<void> {
  const cost = estimateAiUsageCostUsd({
    modelKey: params.modelKey,
    usage: params.usage,
  });

  await updateRunningRun(
    params.runId,
    {
      answer_generation_cost_usd: cost.totalCostUsd,
      answer_generation_usage: createTokenUsageJson(params.usage),
    },
    options,
  );
}

/**
 * 문맥 기반 질의 확장 결과를 Run에 저장합니다.
 *
 * @param params 확장 질의 저장에 필요한 실행 정보
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function saveNoteChatExpandedQuery(
  params: SaveNoteChatExpandedQueryParams,
  options: {
    supabase?: NoteChatRunPersistenceClient | undefined;
  } = {},
): Promise<void> {
  await updateRunningRun(
    params.runId,
    {
      expanded_query: params.expandedQuery,
    },
    options,
  );
}

/**
 * 실행에 사용할 Source Snapshot을 Run에 저장합니다.
 *
 * 답변 생성 또는 응답 파싱이 실패하더라도 어떤 Context가 Provider에
 * 제공됐는지 감사 화면에서 확인할 수 있게 성공 완료와 별도로 저장합니다.
 *
 * @param params Source Snapshot 저장 정보
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function saveNoteChatRunSources(
  params: SaveNoteChatRunSourcesParams,
  options: {
    supabase?: NoteChatRunPersistenceClient | undefined;
  } = {},
): Promise<void> {
  await updateRunningRun(
    params.runId,
    {
      sources: params.sources,
    },
    options,
  );
}

/**
 * 노트 챗봇 Run을 성공 상태로 완료합니다.
 *
 * Run은 실행 제어가 아닌 감사 기록입니다.
 * 기능적 성공은 execution claim 계층에서 Assistant Message 저장과
 * Claim succeeded 전환을 먼저 원자적으로 확정한 뒤 기록합니다.
 *
 * @param params 성공 완료에 필요한 실행 결과
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function completeNoteChatRunSuccess(
  params: CompleteNoteChatRunSuccessParams,
  options: {
    supabase?: NoteChatRunPersistenceClient | undefined;
  } = {},
): Promise<void> {
  const completedAt = new Date().toISOString();

  await updateRunningRun(
    params.runId,
    {
      assistant_message_id: params.assistantMessageId,
      completed_at: completedAt,
      sources: params.sources,
      status: AI_RUN_STATUS.SUCCEEDED,
    },
    options,
  );
}

/**
 * 노트 챗봇 Run을 실패 상태로 완료합니다.
 *
 * Run은 감사 기록이므로 이 갱신 실패가 사용자 기능의 원래 실패 원인을
 * 덮어쓰지 않도록 호출 계층에서 best-effort로 처리합니다.
 *
 * @param params 실패 완료에 필요한 실행 결과
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function completeNoteChatRunFailure(
  params: CompleteNoteChatRunFailureParams,
  options: {
    supabase?: NoteChatRunPersistenceClient | undefined;
  } = {},
): Promise<void> {
  const completedAt = new Date().toISOString();

  await updateRunningRun(
    params.runId,
    {
      completed_at: completedAt,
      failure_message: params.failureMessage,
      status: AI_RUN_STATUS.FAILED,
    },
    options,
  );
}

/**
 * running 상태인 Note Chat Run을 갱신합니다.
 *
 * Run은 감사 기록이므로 이 함수의 오류는 호출 계층에서 operational error로
 * 보고한 뒤 사용자 기능 실행을 계속할 수 있습니다.
 *
 * @param runId 갱신할 Run ID
 * @param values 저장할 snapshot 값
 * @param options 테스트에서 주입할 Supabase Client
 */
async function updateRunningRun(
  runId: string,
  values: Record<string, Json | string | string[] | number | null>,
  options: {
    supabase?: NoteChatRunPersistenceClient | undefined;
  },
): Promise<void> {
  const supabase = options.supabase ?? createAdminClient();

  const { data, error } = await supabase
    .from("note_chat_runs")
    .update(values)
    .eq("id", runId)
    .eq("status", AI_RUN_STATUS.RUNNING)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update note chat run: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Running note chat run not found: ${runId}`);
  }
}

/**
 * Provider Token Usage를 DB JSON 저장 형식으로 변환합니다.
 *
 * @param usage Provider 공통 Token 사용량
 * @returns JSON으로 저장 가능한 Token Usage
 */
function createTokenUsageJson(usage: AiTokenUsage): Json {
  return {
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
  };
}
