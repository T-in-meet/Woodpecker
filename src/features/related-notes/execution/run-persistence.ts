import type { AiTokenUsage } from "@/features/ai/providers/types";
import { estimateAiUsageCostUsd } from "@/features/ai/usage/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/db.helpers";

import {
  RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT,
  RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_SQLSTATE,
} from "../constants/ai";
import type { RelatedNoteAiRecommendation } from "../types";

/** Related Notes 추천 Run 상태입니다. */
export const RELATED_NOTE_RECOMMENDATION_RUN_STATUS = {
  RUNNING: "running",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  STALE: "stale",
} as const;

/** Related Notes 추천 Run 상태 타입입니다. */
export type RelatedNoteRecommendationRunStatus =
  (typeof RELATED_NOTE_RECOMMENDATION_RUN_STATUS)[keyof typeof RELATED_NOTE_RECOMMENDATION_RUN_STATUS];

/** Related Notes 추천 Run claim 상태입니다. */
export const RELATED_NOTE_RECOMMENDATION_RUN_CLAIM_STATUS = {
  CLAIMED: "claimed",
  DUPLICATE: "duplicate",
} as const;

/** Related Notes 추천 Run claim 상태 타입입니다. */
export type RelatedNoteRecommendationRunClaimStatus =
  (typeof RELATED_NOTE_RECOMMENDATION_RUN_CLAIM_STATUS)[keyof typeof RELATED_NOTE_RECOMMENDATION_RUN_CLAIM_STATUS];

/** Related Notes 추천 Run 갱신 단계입니다. */
export const RELATED_NOTE_RECOMMENDATION_RUN_UPDATE_STEP = {
  QUERY_EXPANSION: "query_expansion",
  QUERY_EMBEDDING: "query_embedding",
  MATCHED_NOTES: "matched_notes",
  RECOMMENDATIONS: "recommendations",
} as const;

/** Related Notes 추천 Run 갱신 단계 타입입니다. */
export type RelatedNoteRecommendationRunUpdateStep =
  (typeof RELATED_NOTE_RECOMMENDATION_RUN_UPDATE_STEP)[keyof typeof RELATED_NOTE_RECOMMENDATION_RUN_UPDATE_STEP];

/** Related Notes 추천 Run 저장에 필요한 Supabase Admin Client 최소 형태입니다. */
type RelatedNoteRecommendationRunPersistenceClient = Pick<
  ReturnType<typeof createAdminClient>,
  "from"
>;

/** Related Notes 추천 Run 생성 입력입니다. */
export type CreateRelatedNoteRecommendationRunParams = {
  /** 추천 대상 Note ID입니다. */
  noteId: string;

  /** 추천 대상 Note의 소유 사용자 ID입니다. */
  userId: string;

  /** 추천 생성에 사용한 Note snapshot의 updated_at입니다. */
  sourceUpdatedAt: string;

  /** Query Expansion Chat Model Config ID입니다. */
  queryExpansionModelConfigId: string;

  /** Note retrieval Embedding Model Config ID입니다. */
  embeddingModelConfigId: string;

  /** Answer Generation Chat Model Config ID입니다. */
  answerGenerationModelConfigId: string;
};

/** Related Notes 추천 Run claim 결과입니다. */
export type CreateRelatedNoteRecommendationRunResult =
  | {
      /** 새 Run을 claim했습니다. */
      status: typeof RELATED_NOTE_RECOMMENDATION_RUN_CLAIM_STATUS.CLAIMED;

      /** 생성된 Run ID입니다. */
      runId: string;
    }
  | {
      /** 같은 Note version의 실행이 이미 존재합니다. */
      status: typeof RELATED_NOTE_RECOMMENDATION_RUN_CLAIM_STATUS.DUPLICATE;

      /** 기존 running/succeeded Run ID입니다. */
      runId: string;
    };

/** Query Expansion usage 저장 입력입니다. */
export type SaveRelatedNoteRunQueryExpansionParams = {
  /** 갱신할 Run ID입니다. */
  runId: string;

  /** Query Expansion Provider usage입니다. */
  usage: AiTokenUsage;

  /** 비용 추정에 사용할 model key입니다. */
  modelKey: string;
};

/** 확정된 Query Expansion 검색 질의 저장 입력입니다. */
export type SaveRelatedNoteRunExpandedQueryParams = {
  /** 갱신할 Run ID입니다. */
  runId: string;

  /** Query Expansion으로 생성하고 검증한 검색 질의입니다. */
  expandedQuery: string;
};

/** Query embedding usage 저장 입력입니다. */
export type SaveRelatedNoteRunQueryEmbeddingParams = {
  /** 갱신할 Run ID입니다. */
  runId: string;

  /** Query embedding Provider usage입니다. */
  usage: AiTokenUsage;

  /** 비용 추정에 사용할 model key입니다. */
  modelKey: string;
};

/** 검색된 Note ID snapshot 저장 입력입니다. */
export type SaveRelatedNoteRunMatchedNotesParams = {
  /** 갱신할 Run ID입니다. */
  runId: string;

  /** 검색 결과에 포함된 Note ID 목록입니다. */
  matchedNoteIds: string[];
};

/** Answer Generation 결과 저장 입력입니다. */
export type SaveRelatedNoteRunRecommendationsParams = {
  /** 갱신할 Run ID입니다. */
  runId: string;

  /** 실행 당시 추천 결과 snapshot입니다. */
  recommendations: RelatedNoteAiRecommendation[];
};

/** Answer Generation usage 저장 입력입니다. */
export type SaveRelatedNoteRunAnswerGenerationUsageParams = {
  /** 갱신할 Run ID입니다. */
  runId: string;

  /** Answer Generation Provider usage입니다. */
  usage: AiTokenUsage;

  /** 비용 추정에 사용할 model key입니다. */
  modelKey: string;
};

/** Related Notes 추천 Run 완료 입력입니다. */
export type CompleteRelatedNoteRecommendationRunParams = {
  /** 완료할 Run ID입니다. */
  runId: string;

  /** 완료 상태입니다. */
  status:
    | typeof RELATED_NOTE_RECOMMENDATION_RUN_STATUS.SUCCEEDED
    | typeof RELATED_NOTE_RECOMMENDATION_RUN_STATUS.FAILED
    | typeof RELATED_NOTE_RECOMMENDATION_RUN_STATUS.STALE;

  /** 실패 상태로 완료할 때 저장할 실패 메시지입니다. */
  failureMessage?: string;
};

/**
 * Related Notes 추천 Run을 running 상태로 claim합니다.
 *
 * DB RPC에서 quota, 관리자 bypass, 동일 Note version 중복 실행 방지를
 * 하나의 transaction 안에서 처리합니다.
 *
 * @param params Run 생성에 필요한 Note, 사용자 및 Runtime snapshot
 * @param options 테스트에서 주입할 Supabase Client
 * @returns Run claim 결과
 */
export async function createRelatedNoteRecommendationRun(
  params: CreateRelatedNoteRecommendationRunParams,
  options: {
    supabase?:
      | (RelatedNoteRecommendationRunPersistenceClient &
          Pick<ReturnType<typeof createAdminClient>, "rpc">)
      | undefined;
  } = {},
): Promise<CreateRelatedNoteRecommendationRunResult> {
  const supabase = options.supabase ?? createAdminClient();

  const { data, error } = await supabase.rpc(
    "claim_related_note_recommendation_run",
    {
      p_answer_generation_model_config_id: params.answerGenerationModelConfigId,
      p_daily_recommendation_limit: RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT,
      p_embedding_model_config_id: params.embeddingModelConfigId,
      p_note_id: params.noteId,
      p_query_expansion_model_config_id: params.queryExpansionModelConfigId,
      p_source_updated_at: params.sourceUpdatedAt,
      p_user_id: params.userId,
    },
  );

  if (error) {
    if (error.code === RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_SQLSTATE) {
      throw new RelatedNoteRecommendationDailyLimitError();
    }

    throw new Error(
      `Failed to claim related note recommendation run: ${error.message}`,
    );
  }

  const result = data[0];

  if (!result) {
    throw new Error("Related note recommendation run claim returned no row.");
  }

  if (
    result.status !== RELATED_NOTE_RECOMMENDATION_RUN_CLAIM_STATUS.CLAIMED &&
    result.status !== RELATED_NOTE_RECOMMENDATION_RUN_CLAIM_STATUS.DUPLICATE
  ) {
    throw new Error(
      `Unexpected related note recommendation run claim status: ${result.status}`,
    );
  }

  if (result.run_id === null) {
    throw new Error(
      "Related note recommendation run claim returned no run ID.",
    );
  }

  return {
    runId: result.run_id,
    status: result.status,
  };
}

/**
 * Related Notes 추천 일일 실행 제한 초과를 나타내는 오류입니다.
 */
export class RelatedNoteRecommendationDailyLimitError extends Error {
  constructor() {
    super("Related Notes daily recommendation limit exceeded.");
    this.name = "RelatedNoteRecommendationDailyLimitError";
  }
}

/**
 * Query Expansion Provider usage와 비용을 Run에 저장합니다.
 *
 * Provider 호출 직후 usage를 저장하여 이후 응답 파싱이나 검증이 실패하더라도
 * 이미 발생한 Query Expansion 사용량과 비용을 보존합니다.
 *
 * @param params Query Expansion Provider usage
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function saveRelatedNoteRunQueryExpansion(
  params: SaveRelatedNoteRunQueryExpansionParams,
  options: {
    supabase?: RelatedNoteRecommendationRunPersistenceClient | undefined;
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
 * 파싱과 검증을 통과한 Query Expansion 검색 질의를 Run에 저장합니다.
 *
 * Provider usage 저장과 분리하여 응답 파싱 또는 검증 실패 시에는
 * 확정되지 않은 expanded query가 Run에 기록되지 않도록 합니다.
 *
 * @param params 확정된 Query Expansion 검색 질의
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function saveRelatedNoteRunExpandedQuery(
  params: SaveRelatedNoteRunExpandedQueryParams,
  options: {
    supabase?: RelatedNoteRecommendationRunPersistenceClient | undefined;
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
 * Query embedding usage를 Run에 저장합니다.
 *
 * @param params Query embedding 실행 usage
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function saveRelatedNoteRunQueryEmbedding(
  params: SaveRelatedNoteRunQueryEmbeddingParams,
  options: {
    supabase?: RelatedNoteRecommendationRunPersistenceClient | undefined;
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
 * 검색된 Note ID snapshot을 Run에 저장합니다.
 *
 * @param params 검색 결과 Note ID 목록
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function saveRelatedNoteRunMatchedNotes(
  params: SaveRelatedNoteRunMatchedNotesParams,
  options: {
    supabase?: RelatedNoteRecommendationRunPersistenceClient | undefined;
  } = {},
): Promise<void> {
  await updateRunningRun(
    params.runId,
    {
      matched_note_ids: params.matchedNoteIds,
    },
    options,
  );
}

/**
 * Answer Generation usage를 Run에 저장합니다.
 *
 * @param params Answer Generation usage
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function saveRelatedNoteRunAnswerGenerationUsage(
  params: SaveRelatedNoteRunAnswerGenerationUsageParams,
  options: {
    supabase?: RelatedNoteRecommendationRunPersistenceClient | undefined;
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
 * 실행 당시 추천 결과 snapshot을 Run에 저장합니다.
 *
 * @param params 추천 결과 snapshot
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function saveRelatedNoteRunRecommendations(
  params: SaveRelatedNoteRunRecommendationsParams,
  options: {
    supabase?: RelatedNoteRecommendationRunPersistenceClient | undefined;
  } = {},
): Promise<void> {
  await updateRunningRun(
    params.runId,
    {
      recommendations: createRecommendationsJson(params.recommendations),
    },
    options,
  );
}

/**
 * Related Notes 추천 Run을 최종 상태로 완료합니다.
 *
 * @param params 완료할 Run ID와 완료 상태
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function completeRelatedNoteRecommendationRun(
  params: CompleteRelatedNoteRecommendationRunParams,
  options: {
    supabase?: RelatedNoteRecommendationRunPersistenceClient | undefined;
  } = {},
): Promise<void> {
  const supabase = options.supabase ?? createAdminClient();
  const completedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("related_note_recommendation_runs")
    .update({
      completed_at: completedAt,
      ...(params.failureMessage !== undefined
        ? { failure_message: params.failureMessage }
        : {}),
      status: params.status,
    })
    .eq("id", params.runId)
    .eq("status", RELATED_NOTE_RECOMMENDATION_RUN_STATUS.RUNNING)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to complete related note recommendation run: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      `Running related note recommendation run not found: ${params.runId}`,
    );
  }
}

/**
 * running 상태인 Related Notes 추천 Run을 갱신하고 total cost를 재계산합니다.
 *
 * usage/cost가 아닌 snapshot 필드만 갱신하는 경우에도 공통 갱신 경로를 사용하므로
 * 기존 단계별 cost를 다시 합산하여 동일한 total_cost_usd를 저장할 수 있습니다.
 * 이는 비용 중복 누적이나 집계 오류가 아니며, 저장 로직을 단순하게 유지하기 위해
 * 허용하는 추가 UPDATE입니다.
 *
 * @param runId 갱신할 Run ID
 * @param values 저장할 snapshot 값
 * @param options 테스트에서 주입할 Supabase Client
 */
async function updateRunningRun(
  runId: string,
  values: Record<string, Json | string[] | number | null>,
  options: {
    supabase?: RelatedNoteRecommendationRunPersistenceClient | undefined;
  },
): Promise<void> {
  const supabase = options.supabase ?? createAdminClient();

  const { data, error } = await supabase
    .from("related_note_recommendation_runs")
    .update(values)
    .eq("id", runId)
    .eq("status", RELATED_NOTE_RECOMMENDATION_RUN_STATUS.RUNNING)
    .select(
      "id, query_expansion_cost_usd, query_embedding_cost_usd, answer_generation_cost_usd",
    )
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to update related note recommendation run: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      `Running related note recommendation run not found: ${runId}`,
    );
  }

  const totalCostUsd =
    (data.query_expansion_cost_usd ?? 0) +
    (data.query_embedding_cost_usd ?? 0) +
    (data.answer_generation_cost_usd ?? 0);

  const { error: totalCostError } = await supabase
    .from("related_note_recommendation_runs")
    .update({
      total_cost_usd: totalCostUsd,
    })
    .eq("id", runId)
    .eq("status", RELATED_NOTE_RECOMMENDATION_RUN_STATUS.RUNNING);

  if (totalCostError) {
    throw new Error(
      `Failed to update related note recommendation run total cost: ${totalCostError.message}`,
    );
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

/**
 * AI 추천 결과를 JSON snapshot으로 변환합니다.
 *
 * @param recommendations 실행 당시 Related Notes 추천 결과
 * @returns DB에 저장 가능한 추천 snapshot
 */
function createRecommendationsJson(
  recommendations: RelatedNoteAiRecommendation[],
): Json {
  return recommendations.map((recommendation) => ({
    noteId: recommendation.noteId,
    reason: recommendation.reason,
    title: recommendation.title,
  }));
}
