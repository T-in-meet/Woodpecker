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
  "from"
>;

/** 테스트에서만 persistence client를 교체하기 위한 옵션입니다. */
type AiRunPersistenceOptions = {
  /** 주입하지 않으면 공통 Supabase Admin Client를 생성합니다. */
  supabase?: AiRunPersistenceClient | undefined;
};

/** operational error에 포함할 수 있는 안전한 AI Run 식별 context입니다. */
type AiRunOperationalContext = {
  /** 생성 이후 확보된 AI Run ID입니다. */
  aiRunId?: string;

  /** 인증·인가된 사용자 ID입니다. */
  userId: string;
};

/**
 * 초기 Snapshot을 검증한 뒤 AI Run을 best-effort로 생성합니다.
 *
 * @param params 인증·인가 뒤 확정된 Run 생성 입력
 * @param options 테스트용 persistence client
 * @returns 생성된 Run ID 또는 operational failure인 경우 null
 */
export async function createAiRun(
  params: CreateAiRunParams,
  options: AiRunPersistenceOptions = {},
): Promise<string | null> {
  // DB client를 만들기 전에 초기 Snapshot 전체를 build하고 검증한다.
  const snapshot = await buildSnapshotSafely({
    buildSnapshot: params.buildSnapshot,
    operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_AI_RUN,
    userId: params.userId,
  });

  if (!snapshot.ok) {
    return null;
  }

  try {
    const supabase = options.supabase ?? createAdminClient();

    // migration의 default를 유지하고 생성에 필수인 값만 명시한다.
    const { data, error } = await supabase
      .from("ai_runs")
      .insert({
        feature_type: params.featureType,
        snapshots: snapshot.value,
        started_at: params.startedAt,
        user_id: params.userId,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      await reportAiRunOperationalFailure({
        code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
        context: { userId: params.userId },
        message: "AI Run 생성 저장에 실패했습니다.",
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_AI_RUN,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      });
      return null;
    }

    if (!data) {
      await reportAiRunOperationalFailure({
        code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
        context: { userId: params.userId },
        message: "AI Run 생성 결과 행을 확인할 수 없습니다.",
        operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_AI_RUN,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      });
      return null;
    }

    return data.id;
  } catch {
    // Supabase client 자체가 throw하는 예외도 원래 AI 실행으로 전파하지 않는다.
    await reportAiRunOperationalFailure({
      code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
      context: { userId: params.userId },
      message: "AI Run 생성 저장에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CREATE_AI_RUN,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
    return null;
  }
}

/**
 * 실행 중 확보한 전체 Snapshot을 running AI Run에 best-effort로 저장합니다.
 *
 * @param params 소유권과 running guard를 포함한 checkpoint 입력
 * @param options 테스트용 persistence client
 */
export async function checkpointAiRun(
  params: CheckpointAiRunParams,
  options: AiRunPersistenceOptions = {},
): Promise<void> {
  // 생성 실패 뒤에는 validation과 DB 호출을 모두 생략한다.
  if (params.aiRunId === null) {
    return;
  }

  const snapshot = await buildSnapshotSafely({
    aiRunId: params.aiRunId,
    buildSnapshot: params.buildSnapshot,
    operation: AI_OPERATIONAL_ERROR_OPERATION.CHECKPOINT_AI_RUN,
    userId: params.userId,
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
      context: { aiRunId: params.aiRunId, userId: params.userId },
      message: "AI Run checkpoint client 생성에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.CHECKPOINT_AI_RUN,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
    return;
  }

  await updateRunningAiRunSafely({
    aiRunId: params.aiRunId,
    operation: AI_OPERATIONAL_ERROR_OPERATION.CHECKPOINT_AI_RUN,
    supabase,
    update: { snapshots: snapshot.value },
    userId: params.userId,
  });
}

/**
 * 성공한 AI Run의 Snapshot, 결과 ID와 lifecycle 상태를 한 번에 저장합니다.
 *
 * @param params 성공 terminal 입력
 * @param options 테스트용 persistence client
 */
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

/**
 * 실패한 AI Run을 빈 결과 ID와 함께 terminal 상태로 저장합니다.
 *
 * @param params 실패 terminal 입력
 * @param options 테스트용 persistence client
 */
export async function completeAiRunFailed(
  params: CompleteAiRunParams,
  options: AiRunPersistenceOptions = {},
): Promise<void> {
  await completeAiRun(params, AI_RUN_STATUS.FAILED, [], options);
}

/** Snapshot build 성공 또는 operational failure 결과입니다. */
type SnapshotBuildResult = { ok: true; value: Json } | { ok: false };

/**
 * 기능별 Snapshot builder를 실행하고 실패를 안전하게 보고합니다.
 *
 * @param params build 함수와 안전한 Run 식별 정보
 * @returns DB에 전달할 Snapshot 또는 실패 표시
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
    // 기능별 Zod parse를 포함한 builder의 결과를 opaque JSON 문서로 취급한다.
    return { ok: true, value: params.buildSnapshot() as Json };
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
 * terminal 상태를 ownership/running guard 아래 한 UPDATE로 저장합니다.
 *
 * @param params 공통 terminal 입력
 * @param status 저장할 terminal 상태
 * @param featureResultIds 이번 실행이 실제 저장한 결과 UUID 목록
 * @param options 테스트용 persistence client
 */
async function completeAiRun(
  params: CompleteAiRunParams,
  status: AiRunTerminalStatus,
  featureResultIds: string[],
  options: AiRunPersistenceOptions,
): Promise<void> {
  // create 실패 뒤에는 terminal build와 DB 저장을 모두 생략한다.
  if (params.aiRunId === null) {
    return;
  }

  const snapshot = await buildSnapshotSafely({
    aiRunId: params.aiRunId,
    buildSnapshot: params.buildSnapshot,
    operation: AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN,
    userId: params.userId,
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
      context: { aiRunId: params.aiRunId, userId: params.userId },
      message: "AI Run terminal client 생성에 실패했습니다.",
      operation: AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN,
      stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    });
    return;
  }

  await updateRunningAiRunSafely({
    aiRunId: params.aiRunId,
    operation: AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN,
    supabase,
    update: {
      completed_at: params.completedAt,
      feature_result_ids: featureResultIds,
      snapshots: snapshot.value,
      status,
    },
    userId: params.userId,
  });
}

/** running AI Run에 적용할 checkpoint 또는 terminal update 값입니다. */
type RunningAiRunUpdate =
  | { snapshots: Json }
  | {
      completed_at: string;
      feature_result_ids: string[];
      snapshots: Json;
      status: AiRunTerminalStatus;
    };

/**
 * ownership/running guard가 포함된 UPDATE를 실행하고 변경 행을 확인합니다.
 *
 * @param params update 값과 안전한 Run 식별 정보
 */
async function updateRunningAiRunSafely(params: {
  aiRunId: string;
  operation:
    | typeof AI_OPERATIONAL_ERROR_OPERATION.CHECKPOINT_AI_RUN
    | typeof AI_OPERATIONAL_ERROR_OPERATION.COMPLETE_AI_RUN;
  supabase: AiRunPersistenceClient;
  update: RunningAiRunUpdate;
  userId: string;
}): Promise<void> {
  const context = { aiRunId: params.aiRunId, userId: params.userId };

  try {
    // Admin client가 RLS를 우회하므로 DB mutation 자체에 ownership/status guard를 둔다.
    const { data, error } = await params.supabase
      .from("ai_runs")
      .update(params.update)
      .eq("id", params.aiRunId)
      .eq("user_id", params.userId)
      .eq("status", AI_RUN_STATUS.RUNNING)
      .select("id")
      .maybeSingle();

    if (error) {
      await reportAiRunOperationalFailure({
        code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
        context,
        message: "AI Run 갱신 저장에 실패했습니다.",
        operation: params.operation,
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
        operation: params.operation,
        stage: AI_OPERATIONAL_ERROR_STAGE.DATABASE,
      });
    }
  } catch {
    // DB SDK의 throw도 best-effort 관측 경계를 벗어나지 않게 한다.
    await reportAiRunOperationalFailure({
      code: AI_OPERATIONAL_ERROR_CODE.AI_RUN_PERSISTENCE_FAILED,
      context,
      message: "AI Run 갱신 저장에 실패했습니다.",
      operation: params.operation,
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
 *
 * @param params 안전한 식별 정보만 포함한 오류 보고 입력
 */
async function reportAiRunOperationalFailure(
  params: ReportAiRunOperationalFailureParams,
): Promise<void> {
  try {
    // Snapshot, Provider 원문, DB 오류 원문은 context/error payload에 넣지 않는다.
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
    // 운영 오류 reporter 자체의 장애도 제품 AI 실행 결과에 영향을 주지 않는다.
  }
}
