import { AI_RUN_STATUS } from "@/features/ai/chats/constants";
import type { AiTokenUsage } from "@/features/ai/providers/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/db.helpers";

import { noteChatAssistantMessageContentSchema } from "../schema";

/** Run 저장에 필요한 Supabase Admin Client 최소 형태입니다. */
type NoteChatRunPersistenceClient = Pick<
  ReturnType<typeof createAdminClient>,
  "from" | "rpc"
>;

/**
 * 노트 챗봇 Run 성공 완료 입력입니다.
 */
export type CompleteNoteChatRunSuccessParams = {
  /** 완료할 Run ID입니다. */
  runId: string;

  /** 생성된 Assistant Message 본문입니다. */
  content: string;

  /**
   * 실제 답변 생성 과정에서 참고한 노트 ID 목록입니다.
   *
   * Context 검색이 연결되기 전에는 빈 배열을 전달합니다.
   */
  usedNoteIds: string[];

  /** 실행에 사용된 Context 출처 Snapshot입니다. */
  sources: Json[];

  /** Provider가 반환한 Token 사용량입니다. */
  usage: AiTokenUsage;
};

/**
 * 노트 챗봇 Run 실패 완료 입력입니다.
 */
export type CompleteNoteChatRunFailureParams = {
  /** 실패 처리할 Run ID입니다. */
  runId: string;

  /**
   * 실패 전까지 확인된 Token 사용량입니다.
   *
   * Provider 결과를 받지 못한 경우 `null`을 전달합니다.
   */
  usage: AiTokenUsage | null;
};

/**
 * 문맥 기반 질의 확장 결과 저장 입력입니다.
 */
export type SaveNoteChatExpandedQueryParams = {
  /** 확장 질의를 생성한 Run ID입니다. */
  runId: string;

  /** 노트 검색에 사용할 문맥 기반 확장 질의입니다. */
  expandedQuery: string;
};

/**
 * 노트 챗봇 Run을 실행 중 상태로 변경합니다.
 *
 * `pending` 상태인 Run만 `running`으로 전환하며,
 * 동시에 실행 시작 시각을 기록합니다.
 *
 * @param runId 실행을 시작할 Run ID
 * @param options 테스트에서 주입할 Supabase Client
 */
export async function markNoteChatRunRunning(
  runId: string,
  options: {
    supabase?: NoteChatRunPersistenceClient | undefined;
  } = {},
): Promise<void> {
  const supabase = options.supabase ?? createAdminClient();
  const startedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("note_chat_runs")
    .update({
      started_at: startedAt,
      status: AI_RUN_STATUS.RUNNING,
      updated_at: startedAt,
    })
    .eq("id", runId)
    .eq("status", AI_RUN_STATUS.PENDING)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to mark note chat run as running: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(`Pending note chat run not found: ${runId}`);
  }
}

/**
 * 문맥 기반 질의 확장 결과를 Run에 저장합니다.
 *
 * 질의 확장은 Run이 `running` 상태로 전환된 뒤 수행되므로,
 * 현재 실행 중인 Run에만 검색에 사용할 확장 질의를 저장합니다.
 *
 * 이 Snapshot은 이후 노트 검색이나 답변 생성이 실패하더라도
 * 해당 Run에서 어떤 검색 질의를 생성했는지 확인하기 위해 보존합니다.
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
  const supabase = options.supabase ?? createAdminClient();
  const updatedAt = new Date().toISOString();

  /*
   * 질의 확장은 실행이 시작된 뒤에만 생성되므로 running Run만 갱신합니다.
   * 이미 완료되었거나 실패한 Run의 실행 Snapshot이 뒤늦게 변경되는 것을
   * 방지하기 위해 상태 조건을 함께 사용합니다.
   */
  const { data, error } = await supabase
    .from("note_chat_runs")
    .update({
      expanded_query: params.expandedQuery,
      updated_at: updatedAt,
    })
    .eq("id", params.runId)
    .eq("status", AI_RUN_STATUS.RUNNING)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to save note chat expanded query: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(`Running note chat run not found: ${params.runId}`);
  }
}

/**
 * 노트 챗봇 Run을 성공 상태로 완료합니다.
 *
 * 데이터베이스 RPC가 다음 작업을 하나의 트랜잭션으로 처리합니다.
 *
 * - Assistant Message 생성
 * - Run의 성공 상태 및 Assistant Message 연결
 * - Sources와 Usage 저장
 * - Conversation 수정 시각 갱신
 *
 * @param params 성공 완료에 필요한 실행 결과
 * @param options 테스트에서 주입할 Supabase Client
 * @returns 생성된 Assistant Message ID
 */
export async function completeNoteChatRunSuccess(
  params: CompleteNoteChatRunSuccessParams,
  options: {
    supabase?: NoteChatRunPersistenceClient | undefined;
  } = {},
): Promise<string> {
  const supabase = options.supabase ?? createAdminClient();

  /*
   * RPC에 전달하기 전에 Assistant Message JSON 구조를 검증합니다.
   * 빈 답변이나 잘못된 참고 노트 ID가 DB에 저장되는 것을 방지합니다.
   */
  const content = noteChatAssistantMessageContentSchema.parse({
    usedNoteIds: params.usedNoteIds,
    text: params.content,
  });

  const { data: assistantMessageId, error } = await supabase.rpc(
    "complete_note_chat_run_success",
    {
      p_content: content,
      p_run_id: params.runId,
      p_sources: params.sources,
      p_usage: createTokenUsageJson(params.usage),
    },
  );

  if (error) {
    throw new Error(
      `Failed to complete note chat run successfully: ${error.message}`,
    );
  }

  if (!assistantMessageId) {
    throw new Error(
      `Note chat success completion returned no assistant message ID: ${params.runId}`,
    );
  }

  return assistantMessageId;
}

/**
 * 노트 챗봇 Run을 실패 상태로 완료합니다.
 *
 * 실패 완료 RPC는 Assistant Message를 생성하지 않고,
 * Run 상태와 종료 시각 및 확인 가능한 Usage만 저장합니다.
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
  const supabase = options.supabase ?? createAdminClient();

  const { data: completedRunId, error } = await supabase.rpc(
    "complete_note_chat_run_failure",
    {
      p_run_id: params.runId,
      p_usage:
        params.usage === null ? null : createTokenUsageJson(params.usage),
    },
  );

  if (error) {
    throw new Error(
      `Failed to complete note chat run as failed: ${error.message}`,
    );
  }

  if (completedRunId !== params.runId) {
    throw new Error(
      `Note chat failure completion returned an unexpected run ID: ${params.runId}`,
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
