import { randomUUID } from "node:crypto";

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

/** Snapshot build 성공 또는 operational failure 결과입니다. */
type SnapshotBuildResult = { ok: true; value: Json } | { ok: false };

/** terminal finalize DB operation의 의미 결과입니다. */
type AiRunFinalizeResult =
  | "inserted"
  | "updated"
  | "already_terminal"
  | "conflict";

/**
 * Run identity를 먼저 확보한 뒤 초기 Snapshot과 running row를 best-effort로 저장합니다.
 *
 * Create persistence 실패 여부와 관계없이 같은 Run identity를 반환합니다.
 */
export async function createAiRun(
  params: CreateAiRunParams,
  options: AiRunPersistenceOptions = {},
): Promise<AiRunPersistenceHandle> {
  const id = options.createRunId?.() ?? randomUUID();

  const baseHandle: AiRunPersistenceHandle = {
    id,
    userId: params.userId,
    featureType: params.featureType,
    startedAt: params.startedAt,
    createPersisted: false,
  };

  const snapshot = await buildSnapshotSafely({
    aiRunId: id,
    buildSnapshot: params.buildSnapshot,
    operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_AI_RUN,
    userId: params.userId,
  });

  if (!snapshot.ok) {
    return baseHandle;
  }

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
      await reportAiRunOperationalFailure({
        code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
        context: { aiRunId: id, userId: params.userId },
        message: "AI Run 생성 저장에 실패했습니다.",
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_AI_RUN,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      });

      return baseHandle;
    }

    return {
      ...baseHandle,
      createPersisted: true,
    };
  } catch {
    await reportAiRunOperationalFailure({
      code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
      context: { aiRunId: id, userId: params.userId },
      message: "AI Run 생성 저장에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_AI_RUN,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    return baseHandle;
  }
}

/**
 * 실행 중 확보한 전체 Snapshot을 running AI Run에 best-effort로 저장합니다.
 */
export async function checkpointAiRun(
  params: CheckpointAiRunParams,
  options: AiRunPersistenceOptions = {},
): Promise<void> {
  // 최초 INSERT가 확립되지 않은 경우 checkpoint를 Create 복구 경로로 사용하지 않는다.
  if (!params.aiRun.createPersisted) {
    return;
  }

  const snapshot = await buildSnapshotSafely({
    aiRunId: params.aiRun.id,
    buildSnapshot: params.buildSnapshot,
    operation: AI_OPERATIONAL_ERROR_OPERATION.CHECKPOINT_AI_RUN,
    userId: params.aiRun.userId,
  });

  if (!snapshot.ok) {
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
}

/** 성공한 AI Run의 최종 Snapshot과 결과 ID를 best-effort로 저장합니다. */
export async function completeAiRunSucceeded(
  params: CompleteAiRunSucceededParams,
  options: AiRunPersistenceOptions = {},
): Promise<void> {
  await completeAiRun(
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
  await completeAiRun(params, AI_RUN_STATUS.FAILED, [], options);
}

/**
 * 기능별 Snapshot builder를 실행하고 실패를 안전하게 보고합니다.
 */
async function buildSnapshotSafely(params: {
  aiRunId?: string;
  buildSnapshot: AiRunSnapshotBuilder;
  operation:
    | typeof AI_OPERATIONAL_ERROR_OPERATION.CREATE_AI_RUN
    | typeof AI_OPERATIONAL_ERROR_OPERATION.CHECKPOINT_AI_RUN
    | typeof AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN;
  userId: string;
}): Promise<SnapshotBuildResult> {
  try {
    return {
      ok: true,
      value: params.buildSnapshot() as Json,
    };
  } catch {
    await reportAiRunOperationalFailure({
      code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_SNAPSHOT_BUILD_FAILED,
      context: {
        ...(params.aiRunId === undefined ? {} : { aiRunId: params.aiRunId }),
        userId: params.userId,
      },
      message: "AI Run Snapshot build 또는 validation에 실패했습니다.",
      operation: params.operation,
      stage: AI_OPERATIONAL_ERROR_STAGE.VALIDATION,
    });

    return { ok: false };
  }
}

/**
 * 성공/실패 terminal Snapshot을 원자적이고 idempotent한 DB operation으로 저장합니다.
 */
async function completeAiRun(
  params: CompleteAiRunParams,
  status: AiRunTerminalStatus,
  featureResultIds: string[],
  options: AiRunPersistenceOptions,
): Promise<void> {
  const snapshot = await buildSnapshotSafely({
    aiRunId: params.aiRun.id,
    buildSnapshot: params.buildSnapshot,
    operation: AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN,
    userId: params.aiRun.userId,
  });

  if (!snapshot.ok) {
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
      message: "AI Run terminal client 생성에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    return;
  }

  const input = {
    p_completed_at: params.completedAt,
    p_feature_result_ids: featureResultIds,
    p_feature_type: params.aiRun.featureType,
    p_run_id: params.aiRun.id,
    p_snapshots: snapshot.value,
    p_started_at: params.aiRun.startedAt,
    p_terminal_status: status,
    p_user_id: params.aiRun.userId,
  };

  const firstAttempt = await finalizeAiRunOnce({
    aiRun: params.aiRun,
    input,
    supabase,
  });

  if (firstAttempt !== "request_failed") {
    return;
  }

  // DB/transport 요청 결과 자체를 얻지 못한 경우에만 동일 idempotent operation을 1회 추가 시도한다.
  const secondAttempt = await finalizeAiRunOnce({
    aiRun: params.aiRun,
    input,
    supabase,
  });

  if (secondAttempt === "request_failed") {
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

/** terminal finalize 1회 호출 결과입니다. */
type FinalizeAttemptResult = AiRunFinalizeResult | "request_failed";

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
      await reportAiRunOperationalFailure({
        code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
        context,
        message: "AI Run terminal 저장에 실패했습니다.",
        operation: AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      });

      return "request_failed";
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

    await reportAiRunOperationalFailure({
      code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
      context,
      message: "AI Run terminal 저장 결과를 확인할 수 없습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    return "request_failed";
  } catch {
    await reportAiRunOperationalFailure({
      code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
      context,
      message: "AI Run terminal 저장에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });

    return "request_failed";
  }
}

/**
 * 기존 running Run에 checkpoint Snapshot만 저장합니다.
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
      fingerprintParts: [params.operation, params.stage],
      message: params.message,
      operation: params.operation,
      stage: params.stage,
      userId: params.context.userId,
    });
  } catch {
    // operational error reporter 장애도 실제 AI 실행 결과에 영향을 주지 않는다.
  }
}
