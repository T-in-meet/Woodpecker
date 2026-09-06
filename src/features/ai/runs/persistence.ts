import { randomUUID } from "node:crypto";

import { after } from "next/server";

import {
  AI_OPERATIONAL_ERROR_CODE,
  AI_OPERATIONAL_ERROR_OPERATION,
  AI_OPERATIONAL_ERROR_STAGE,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/db.helpers";

import { reportAiOperationalError } from "../utils/report-ai-operational-error";
import {
  AI_RUN_STATUS,
  type AiRunPersistenceHandle,
  type AiRunSnapshotBuilder,
  type AiRunTerminalStatus,
  type CheckpointAiRunParams,
  type CompleteAiRunParams,
  type CompleteAiRunSucceededParams,
  type CreateAiRunParams,
} from "./types";

/** AI Run persistence에서 사용하는 Supabase Admin Client 최소 계약입니다. */
type AiRunPersistenceClient = Pick<
  ReturnType<typeof createAdminClient>,
  "from" | "rpc"
>;

/** 테스트에서만 persistence dependency를 교체하기 위한 옵션입니다. */
type AiRunPersistenceOptions = {
  /** 주입하지 않으면 공통 Supabase Admin Client를 생성합니다. */
  supabase?: AiRunPersistenceClient | undefined;

  /** 주입하지 않으면 application에서 UUID를 생성합니다. */
  createRunId?: (() => string) | undefined;
};

/** operational error에 포함할 수 있는 안전한 AI Run 식별 context입니다. */
type AiRunOperationalContext = {
  /** AI execution 시작 시 확보한 AI Run ID입니다. */
  aiRunId?: string;

  /** 인증·인가된 사용자 ID입니다. */
  userId: string;
};

/** Snapshot build 성공 또는 실패 결과입니다. */
type SnapshotBuildResult = { ok: true; value: Json } | { ok: false };

/** terminal finalize DB operation의 의미 결과입니다. */
type AiRunFinalizeResult =
  | "inserted"
  | "updated"
  | "already_terminal"
  | "conflict";

/** create persistence의 내부 상태입니다. */
type AiRunCreatePersistenceStatus = "pending" | "persisted" | "failed";

/** 한 AI Run의 persistence 내부 상태입니다. */
type AiRunPersistenceState = {
  createStatus: AiRunCreatePersistenceStatus;
};

/**
 * 같은 Run의 persistence write를 호출 순서대로 직렬화하기 위한 queue tail입니다.
 */
const aiRunPersistenceQueues = new Map<string, Promise<void>>();

/**
 * create persistence 상태를 호출 계층에 노출하지 않고 내부에서만 관리합니다.
 *
 * Run handle을 WeakMap key로 사용해 terminal에 도달하지 못한 실행도
 * handle이 더 이상 참조되지 않으면 내부 상태가 GC 대상이 될 수 있게 합니다.
 */
const aiRunPersistenceStates = new WeakMap<
  AiRunPersistenceHandle,
  AiRunPersistenceState
>();

/**
 * Run identity를 먼저 확보한 뒤 초기 Snapshot과 running row를 best-effort로 저장합니다.
 *
 * Create persistence 실패 여부와 관계없이 같은 Run identity를 반환합니다.
 * DB persistence는 같은 Run의 ordered queue에서 비동기로 수행합니다.
 * 반환 Promise는 DB persistence 완료를 의미하지 않습니다.
 */
export async function createAiRun(
  params: CreateAiRunParams,
  options: AiRunPersistenceOptions = {},
): Promise<AiRunPersistenceHandle> {
  const id = options.createRunId?.() ?? randomUUID();

  const aiRun: AiRunPersistenceHandle = {
    id,
    userId: params.userId,
    featureType: params.featureType,
    startedAt: params.startedAt,
  };

  /*
   * Snapshot은 accumulator가 이후 단계에서 변경되기 전에
   * 현재 호출 시점의 값을 확정합니다.
   */
  const snapshot = buildSnapshotSafely(params.buildSnapshot);

  if (!snapshot.ok) {
    enqueueAiRunPersistenceTask(id, async () => {
      await reportAiRunSnapshotBuildFailure({
        aiRunId: id,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_AI_RUN,
        userId: params.userId,
      });
    });

    return aiRun;
  }

  const state: AiRunPersistenceState = {
    createStatus: "pending",
  };

  aiRunPersistenceStates.set(aiRun, state);

  enqueueAiRunPersistenceTask(id, async () => {
    try {
      const supabase = options.supabase ?? createAdminClient();

      const { error } = await supabase.from("ai_runs").insert({
        id,
        feature_type: params.featureType,
        snapshots: snapshot.value,
        started_at: params.startedAt,
        user_id: params.userId,
      });

      if (error) {
        state.createStatus = "failed";

        await reportAiRunOperationalFailure({
          code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
          context: { aiRunId: id, userId: params.userId },
          message: "AI Run 생성 저장에 실패했습니다.",
          operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_AI_RUN,
          stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
        });

        return;
      }

      state.createStatus = "persisted";
    } catch {
      state.createStatus = "failed";

      await reportAiRunOperationalFailure({
        code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
        context: { aiRunId: id, userId: params.userId },
        message: "AI Run 생성 저장에 실패했습니다.",
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_AI_RUN,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      });
    }
  });

  return aiRun;
}

/**
 * 실행 중 확보한 전체 Snapshot을 running AI Run에 best-effort로 저장합니다.
 *
 * Snapshot은 호출 시점에 확정하고 DB persistence는 같은 Run queue에서 수행합니다.
 * 반환 Promise는 DB persistence 완료를 의미하지 않습니다.
 */
export async function checkpointAiRun(
  params: CheckpointAiRunParams,
  options: AiRunPersistenceOptions = {},
): Promise<void> {
  const state = aiRunPersistenceStates.get(params.aiRun);

  /*
   * 최초 INSERT가 이미 실패했거나 해당 create 상태가 없으면
   * checkpoint를 Create 복구 경로로 사용하지 않는다.
   */
  if (!state || state.createStatus === "failed") {
    return;
  }

  /*
   * create가 아직 pending이어도 Snapshot은 지금 확정한다.
   * 실제 DB write 여부는 queue에서 create 결과가 확정된 뒤 판단한다.
   */
  const snapshot = buildSnapshotSafely(params.buildSnapshot);

  if (!snapshot.ok) {
    enqueueAiRunPersistenceTask(params.aiRun.id, async () => {
      await reportAiRunSnapshotBuildFailure({
        aiRunId: params.aiRun.id,
        operation: AI_OPERATIONAL_ERROR_OPERATION.CHECKPOINT_AI_RUN,
        userId: params.aiRun.userId,
      });
    });

    return;
  }

  enqueueAiRunPersistenceTask(params.aiRun.id, async () => {
    /*
     * 같은 Run의 create task가 이 checkpoint보다 먼저 실행된다.
     * create가 최종적으로 실패했다면 checkpoint는 저장하지 않는다.
     */
    if (state.createStatus !== "persisted") {
      return;
    }

    let supabase: AiRunPersistenceClient;

    try {
      supabase = options.supabase ?? createAdminClient();
    } catch {
      await reportAiRunOperationalFailure({
        code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
        context: {
          aiRunId: params.aiRun.id,
          userId: params.aiRun.userId,
        },
        message: "AI Run checkpoint client 생성에 실패했습니다.",
        operation: AI_OPERATIONAL_ERROR_OPERATION.CHECKPOINT_AI_RUN,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      });

      return;
    }

    await updateRunningAiRunSnapshotSafely({
      aiRun: params.aiRun,
      snapshot: snapshot.value,
      supabase,
    });
  });
}

/** 성공한 AI Run의 최종 Snapshot과 결과 ID를 best-effort로 저장합니다. */
export async function completeAiRunSucceeded(
  params: CompleteAiRunSucceededParams,
  options: AiRunPersistenceOptions = {},
): Promise<void> {
  completeAiRun(
    params,
    AI_RUN_STATUS.SUCCEEDED,
    params.featureResultIds,
    options,
  );
}

/** 실패한 AI Run을 빈 결과 ID와 함께 best-effort로 저장합니다. */
export async function completeAiRunFailed(
  params: CompleteAiRunParams,
  options: AiRunPersistenceOptions = {},
): Promise<void> {
  completeAiRun(params, AI_RUN_STATUS.FAILED, [], options);
}

/**
 * 기능별 Snapshot builder를 현재 호출 시점에 실행합니다.
 */
function buildSnapshotSafely(
  buildSnapshot: AiRunSnapshotBuilder,
): SnapshotBuildResult {
  try {
    return {
      ok: true,
      value: buildSnapshot() as Json,
    };
  } catch {
    return { ok: false };
  }
}

/**
 * Snapshot build 또는 validation 실패를 원문 없이 안전하게 보고합니다.
 */
async function reportAiRunSnapshotBuildFailure(params: {
  aiRunId: string;
  operation:
    | typeof AI_OPERATIONAL_ERROR_OPERATION.CREATE_AI_RUN
    | typeof AI_OPERATIONAL_ERROR_OPERATION.CHECKPOINT_AI_RUN
    | typeof AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN;
  userId: string;
}): Promise<void> {
  await reportAiRunOperationalFailure({
    code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_SNAPSHOT_BUILD_FAILED,
    context: {
      aiRunId: params.aiRunId,
      userId: params.userId,
    },
    message: "AI Run Snapshot build 또는 validation에 실패했습니다.",
    operation: params.operation,
    stage: AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
  });
}

/**
 * 성공/실패 terminal Snapshot을 원자적이고 idempotent한 DB operation으로 저장합니다.
 *
 * Snapshot은 호출 시점에 확정하고 실제 terminal persistence는
 * 같은 Run queue에서 수행합니다.
 */
function completeAiRun(
  params: CompleteAiRunParams,
  status: AiRunTerminalStatus,
  featureResultIds: string[],
  options: AiRunPersistenceOptions,
): void {
  const snapshot = buildSnapshotSafely(params.buildSnapshot);

  if (!snapshot.ok) {
    enqueueAiRunPersistenceTask(params.aiRun.id, async () => {
      try {
        await reportAiRunSnapshotBuildFailure({
          aiRunId: params.aiRun.id,
          operation: AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN,
          userId: params.aiRun.userId,
        });
      } finally {
        aiRunPersistenceStates.delete(params.aiRun);
      }
    });

    return;
  }

  enqueueAiRunPersistenceTask(params.aiRun.id, async () => {
    try {
      await persistCompletedAiRun({
        aiRun: params.aiRun,
        completedAt: params.completedAt,
        featureResultIds,
        snapshot: snapshot.value,
        status,
        options,
      });
    } finally {
      aiRunPersistenceStates.delete(params.aiRun);
    }
  });
}

/**
 * terminal Snapshot과 실행 결과를 finalize_ai_run RPC로 저장합니다.
 *
 * 요청 결과를 확인할 수 없는 경우 동일한 idempotent operation을 1회 재시도합니다.
 * 동일 요청으로 결과가 달라지지 않는 결정론적 DB 오류는 재시도하지 않습니다.
 */
async function persistCompletedAiRun(params: {
  aiRun: AiRunPersistenceHandle;
  completedAt: string;
  featureResultIds: string[];
  snapshot: Json;
  status: AiRunTerminalStatus;
  options: AiRunPersistenceOptions;
}): Promise<void> {
  let supabase: AiRunPersistenceClient;

  try {
    supabase = params.options.supabase ?? createAdminClient();
  } catch {
    await reportAiRunOperationalFailure({
      code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
      context: {
        aiRunId: params.aiRun.id,
        userId: params.aiRun.userId,
      },
      message: "AI Run terminal client 생성에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    return;
  }

  const input = {
    p_completed_at: params.completedAt,
    p_feature_result_ids: params.featureResultIds,
    p_feature_type: params.aiRun.featureType,
    p_run_id: params.aiRun.id,
    p_snapshots: params.snapshot,
    p_started_at: params.aiRun.startedAt,
    p_terminal_status: params.status,
    p_user_id: params.aiRun.userId,
  };

  const firstAttempt = await finalizeAiRunOnce({
    aiRun: params.aiRun,
    input,
    supabase,
  });

  if (firstAttempt === "non_retryable_request_failed") {
    /*
     * CHECK 위반, 권한 오류처럼 같은 입력으로 재호출해도 결과가 달라지지 않는
     * 결정론적 DB 오류는 불필요한 두 번째 RPC를 수행하지 않습니다.
     */
    await reportAiRunOperationalFailure({
      code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
      context: {
        aiRunId: params.aiRun.id,
        userId: params.aiRun.userId,
      },
      message:
        "AI Run terminal 저장에 재시도할 수 없는 DB 오류가 발생했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    return;
  }

  if (firstAttempt !== "request_failed") {
    return;
  }

  // DB/transport 요청 결과 자체를 얻지 못한 경우에만 동일 idempotent operation을 1회 추가 시도한다.
  const secondAttempt = await finalizeAiRunOnce({
    aiRun: params.aiRun,
    input,
    supabase,
  });

  if (
    secondAttempt === "request_failed" ||
    secondAttempt === "non_retryable_request_failed"
  ) {
    await reportAiRunOperationalFailure({
      code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
      context: {
        aiRunId: params.aiRun.id,
        userId: params.aiRun.userId,
      },
      message: "AI Run terminal 저장 재시도까지 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
  }
}

/**
 * terminal finalize 1회 호출 결과입니다.
 *
 * request_failed는 일시적이거나 종류를 확정할 수 없어 재시도할 수 있는 실패이고,
 * non_retryable_request_failed는 동일 요청을 반복해도 해결되지 않는 DB 오류입니다.
 */
type FinalizeAttemptResult =
  | AiRunFinalizeResult
  | "request_failed"
  | "non_retryable_request_failed";

/**
 * 동일한 입력으로 재시도해도 성공할 수 없는 명확한 PostgreSQL 오류인지 확인합니다.
 *
 * 알 수 없는 오류는 기존 동작을 유지하기 위해 재시도 가능한 오류로 취급합니다.
 */
function isNonRetryableFinalizeError(error: { code?: string | null }): boolean {
  return (
    error.code === "P0001" || // PL/pgSQL RAISE EXCEPTION
    error.code === "23514" || // check_violation
    error.code === "42501" // insufficient_privilege
  );
}

/**
 * terminal finalize DB operation을 정확히 한 번 실행합니다.
 */
async function finalizeAiRunOnce(params: {
  aiRun: AiRunPersistenceHandle;
  input: {
    p_completed_at: string;
    p_feature_result_ids: string[];
    p_feature_type: AiRunPersistenceHandle["featureType"];
    p_run_id: string;
    p_snapshots: Json;
    p_started_at: string;
    p_terminal_status: AiRunTerminalStatus;
    p_user_id: string;
  };
  supabase: AiRunPersistenceClient;
}): Promise<FinalizeAttemptResult> {
  const context = {
    aiRunId: params.aiRun.id,
    userId: params.aiRun.userId,
  };

  try {
    const { data, error } = await params.supabase.rpc(
      "finalize_ai_run",
      params.input,
    );

    if (error) {
      /*
       * 동일 입력으로 해결될 수 없는 명확한 DB 오류만 재시도 대상에서 제외합니다.
       * 그 외 알 수 없는 오류는 기존처럼 1회 재시도합니다.
       */
      return isNonRetryableFinalizeError(error)
        ? "non_retryable_request_failed"
        : "request_failed";
    }

    const result = data as AiRunFinalizeResult;

    if (
      result === "inserted" ||
      result === "updated" ||
      result === "already_terminal"
    ) {
      return result;
    }

    if (result === "conflict") {
      await reportAiRunOperationalFailure({
        code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_GUARD_FAILED,
        context,
        message:
          "AI Run terminal 상태 또는 identity 충돌로 저장하지 않았습니다.",
        operation: AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      });

      return result;
    }

    return "request_failed";
  } catch {
    return "request_failed";
  }
}

/**
 * running 상태인 해당 AI Run에 checkpoint Snapshot만 저장합니다.
 *
 * Run ID, 사용자 ID, running 상태를 모두 만족하는 행만 갱신합니다.
 */
async function updateRunningAiRunSnapshotSafely(params: {
  aiRun: AiRunPersistenceHandle;
  snapshot: Json;
  supabase: AiRunPersistenceClient;
}): Promise<void> {
  const context = {
    aiRunId: params.aiRun.id,
    userId: params.aiRun.userId,
  };

  try {
    const { data, error } = await params.supabase
      .from("ai_runs")
      .update({ snapshots: params.snapshot })
      .eq("id", params.aiRun.id)
      .eq("user_id", params.aiRun.userId)
      .eq("status", AI_RUN_STATUS.RUNNING)
      .select("id")
      .maybeSingle();

    if (error) {
      await reportAiRunOperationalFailure({
        code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
        context,
        message: "AI Run checkpoint 저장에 실패했습니다.",
        operation: AI_OPERATIONAL_ERROR_OPERATION.CHECKPOINT_AI_RUN,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      });

      return;
    }

    if (!data) {
      await reportAiRunOperationalFailure({
        code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_GUARD_FAILED,
        context,
        message:
          "AI Run ownership 또는 running guard를 충족하는 행이 없습니다.",
        operation: AI_OPERATIONAL_ERROR_OPERATION.CHECKPOINT_AI_RUN,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      });
    }
  } catch {
    await reportAiRunOperationalFailure({
      code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
      context,
      message: "AI Run checkpoint 저장에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CHECKPOINT_AI_RUN,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
  }
}

/** AI Run operational failure 보고 입력입니다. */
type ReportAiRunOperationalFailureParams = {
  code:
    | typeof AI_OPERATIONAL_ERROR_CODE.AI_RUN_GUARD_FAILED
    | typeof AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED
    | typeof AI_OPERATIONAL_ERROR_CODE.AI_RUN_SNAPSHOT_BUILD_FAILED;
  context: AiRunOperationalContext;
  message: string;
  operation:
    | typeof AI_OPERATIONAL_ERROR_OPERATION.CREATE_AI_RUN
    | typeof AI_OPERATIONAL_ERROR_OPERATION.CHECKPOINT_AI_RUN
    | typeof AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN;
  stage:
    | typeof AI_OPERATIONAL_ERROR_STAGE.DATABASE
    | typeof AI_OPERATIONAL_ERROR_STAGE.VALIDATION;
};

/**
 * 원문 없이 AI Run operational failure를 보고하고 reporter 실패도 격리합니다.
 */
async function reportAiRunOperationalFailure(
  params: ReportAiRunOperationalFailureParams,
): Promise<void> {
  try {
    await reportAiOperationalError({
      context: params.context,
      errorCode: params.code,
      message: params.message,
      operation: params.operation,
      stage: params.stage,
      userId: params.context.userId,
    });
  } catch {
    // operational error reporter 장애도 실제 AI 실행 결과에 영향을 주지 않는다.
  }
}

/**
 * 같은 Run의 persistence 작업을 호출 순서대로 직렬화합니다.
 *
 * 한 작업의 실패가 다음 checkpoint/terminal 작업을 막지 않도록
 * queue 경계에서 rejection을 격리합니다.
 */
function enqueueAiRunPersistenceTask(
  aiRunId: string,
  task: () => Promise<void>,
): void {
  const previous = aiRunPersistenceQueues.get(aiRunId) ?? Promise.resolve();

  const current = previous
    .catch(() => undefined)
    .then(task)
    .catch(() => undefined)
    .finally(() => {
      /*
       * 현재 task 실행 중 같은 Run에 다음 task가 연결될 수 있으므로
       * 자신이 여전히 최신 tail인 경우에만 제거합니다.
       */
      if (aiRunPersistenceQueues.get(aiRunId) === current) {
        aiRunPersistenceQueues.delete(aiRunId);
      }
    });

  aiRunPersistenceQueues.set(aiRunId, current);

  registerAiRunPersistenceTask(current);
}

/**
 * background persistence가 response 반환 이후에도
 * 현재 request lifecycle 안에서 실행될 수 있도록 등록합니다.
 */
function registerAiRunPersistenceTask(task: Promise<void>): void {
  try {
    after(() => task);
  } catch {
    /*
     * lifecycle 등록 실패도 기존 AI 기능 실행으로 전파하지 않는다.
     * queue task 자체는 이미 시작된 best-effort 작업이다.
     */
  }
}
