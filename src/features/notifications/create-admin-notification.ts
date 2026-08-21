import {
  NOTIFICATION_OPERATIONAL_ERROR_CODES,
  NOTIFICATION_OPERATIONAL_ERROR_FEATURES,
  NOTIFICATION_OPERATIONAL_ERROR_OPERATIONS,
  NOTIFICATION_OPERATIONAL_ERROR_STAGES,
  OPERATIONAL_ERROR_SEVERITY,
} from "@/features/operational-errors/constants";
import { recordOperationalError } from "@/features/operational-errors/record";
import {
  ADMIN_NOTIFICATION_TYPES,
  type AdminNotificationKindType,
} from "@/lib/constants/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/db.helpers";

import { dispatchPushToUser } from "./dispatch-push";

/**
 * 관리자 알림 생성 요청의 공통 입력값입니다.
 */
type CreateAdminNotificationCommonInput = {
  body?: string | null;
  clickPath: string;
  createdBy?: string | null;
  metadata?: Record<string, Json>;
  pushEnabled?: boolean;
  title: string;
};

/**
 * 관리자 알림 생성 요청 입력값입니다.
 */
export type CreateAdminNotificationInput = CreateAdminNotificationCommonInput &
  (
    | {
        feedbackId: string;
        type: typeof ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED;
      }
    | {
        feedbackId?: never;
        type: typeof ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR;
      }
  );

/**
 * 관리자 알림 생성 실패 단계 타입입니다.
 */
export type AdminNotificationFailureStage =
  | typeof NOTIFICATION_OPERATIONAL_ERROR_STAGES.ADMIN_NOTIFICATION_TARGET_LOOKUP
  | typeof NOTIFICATION_OPERATIONAL_ERROR_STAGES.IN_APP_NOTIFICATION_CREATE;

export type CreateAdminNotificationResult =
  | {
      id: string;
      ok: true;
      targetAdminCount: number;
    }
  | {
      error: unknown;
      failureStage: AdminNotificationFailureStage;
      ok: false;
      operationalErrorRecorded: boolean;
    };

function getAdminNotificationOperation(type: AdminNotificationKindType) {
  if (type === ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR) {
    return NOTIFICATION_OPERATIONAL_ERROR_OPERATIONS.CREATE_ADMIN_OPERATIONAL_ERROR_NOTIFICATION;
  }

  return NOTIFICATION_OPERATIONAL_ERROR_OPERATIONS.CREATE_ADMIN_FEEDBACK_NOTIFICATION;
}

function withCreatedBy(createdBy: string | null | undefined) {
  return createdBy === undefined ? {} : { actorUserId: createdBy };
}

/**
 * 관리자 알림 종류별 운영 오류 메시지를 반환합니다.
 *
 * @param type 관리자 알림 종류
 * @returns 관리자 화면에 표시할 운영 오류 메시지
 */
function getAdminNotificationCreateFailureMessage(
  type: AdminNotificationKindType,
) {
  if (type === ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR) {
    return "운영 오류 관리자 알림 생성에 실패했습니다.";
  }

  return "새 피드백 관리자 알림 생성에 실패했습니다.";
}

/**
 * 관리자 알림 생성 실패를 추적하기 위한 공통 context를 만듭니다.
 *
 * 피드백 알림은 feedbackId를 명시적으로 남겨 관리자 화면에서 clickPath를
 * 역산하지 않고 원본 피드백을 추적할 수 있게 합니다.
 *
 * @param input 관리자 알림 생성 요청 정보
 * @returns 운영 오류 context
 */
function createAdminNotificationFailureContext(
  input: CreateAdminNotificationInput,
) {
  return {
    ...(input.type === ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED
      ? { feedbackId: input.feedbackId }
      : {}),
    clickPath: input.clickPath,
    notificationType: input.type,
  };
}

function createPushPayload(
  input: CreateAdminNotificationInput,
  adminNotificationEventId: string,
) {
  return {
    ...(input.body ? { body: input.body } : {}),
    data: {
      ...(input.metadata ?? {}),
      adminNotificationEventId,
      type: input.type,
      url: input.clickPath,
    },
    title: input.title,
  };
}

/**
 * 관리자 알림 생성 실패를 운영 오류로 기록합니다.
 *
 * @param input 관리자 알림 생성 요청 정보
 * @param error 관리자 알림 생성 중 발생한 오류
 * @returns 운영 오류 기록 성공 여부
 */
export async function recordAdminNotificationCreateFailure(
  input: CreateAdminNotificationInput,
  error: unknown,
) {
  const result = await recordOperationalError({
    ...withCreatedBy(input.createdBy),
    context: createAdminNotificationFailureContext(input),
    error,
    errorCode:
      NOTIFICATION_OPERATIONAL_ERROR_CODES.ADMIN_NOTIFICATION_CREATE_FAILED,
    feature: NOTIFICATION_OPERATIONAL_ERROR_FEATURES.NOTIFICATIONS,
    message: getAdminNotificationCreateFailureMessage(input.type),
    operation: getAdminNotificationOperation(input.type),
    severity: OPERATIONAL_ERROR_SEVERITY.WARN,
    stage: NOTIFICATION_OPERATIONAL_ERROR_STAGES.IN_APP_NOTIFICATION_CREATE,
  });

  return result.ok;
}

/**
 * 관리자 알림 Push 대상 조회 실패를 운영 오류로 기록합니다.
 *
 * @param input 관리자 알림 생성 요청 정보
 * @param adminNotificationEventId 생성된 관리자 알림 이벤트 ID
 * @param error 관리자 목록 조회 중 발생한 오류
 * @returns 운영 오류 기록 성공 여부
 */
async function recordAdminNotificationTargetLookupFailure(
  input: CreateAdminNotificationInput,
  adminNotificationEventId: string,
  error: unknown,
) {
  const result = await recordOperationalError({
    ...withCreatedBy(input.createdBy),
    context: {
      ...createAdminNotificationFailureContext(input),
      adminNotificationEventId,
    },
    error,
    errorCode:
      NOTIFICATION_OPERATIONAL_ERROR_CODES.ADMIN_NOTIFICATION_TARGET_LOOKUP_FAILED,
    feature: NOTIFICATION_OPERATIONAL_ERROR_FEATURES.NOTIFICATIONS,
    message: "관리자 알림 Push 대상 조회에 실패했습니다.",
    operation: getAdminNotificationOperation(input.type),
    severity: OPERATIONAL_ERROR_SEVERITY.WARN,
    stage:
      NOTIFICATION_OPERATIONAL_ERROR_STAGES.ADMIN_NOTIFICATION_TARGET_LOOKUP,
  });

  return result.ok;
}

/**
 * 관리자 공용 알림 이벤트를 한 번 생성하고 모든 관리자에게 Push를 전송합니다.
 *
 * 관리자별 읽음 상태는 admin_notification_reads에 별도로 저장하므로,
 * 여기서는 이벤트 row만 만들고 대상 관리자 목록은 profiles.role로 계산합니다.
 */
export async function createAdminNotification(
  input: CreateAdminNotificationInput,
): Promise<CreateAdminNotificationResult> {
  const supabase = createAdminClient();
  const { data: event, error } = await supabase
    .from("admin_notification_events")
    .insert({
      body: input.body ?? null,
      click_path: input.clickPath,
      created_by: input.createdBy ?? null,
      feedback_id:
        input.type === ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED
          ? input.feedbackId
          : null,
      metadata: input.metadata ?? {},
      title: input.title,
      type: input.type,
    })
    .select("id")
    .single();

  if (error) {
    const operationalErrorRecorded = await recordAdminNotificationCreateFailure(
      input,
      error,
    );

    return {
      error,
      failureStage:
        NOTIFICATION_OPERATIONAL_ERROR_STAGES.IN_APP_NOTIFICATION_CREATE,
      ok: false,
      operationalErrorRecorded,
    };
  }

  const { data: admins, error: adminsError } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "ADMIN");

  if (adminsError) {
    const operationalErrorRecorded =
      await recordAdminNotificationTargetLookupFailure(
        input,
        event.id,
        adminsError,
      );

    return {
      error: adminsError,
      failureStage:
        NOTIFICATION_OPERATIONAL_ERROR_STAGES.ADMIN_NOTIFICATION_TARGET_LOOKUP,
      ok: false,
      operationalErrorRecorded,
    };
  }

  const adminIds = admins?.map((admin) => admin.id) ?? [];

  if (input.pushEnabled !== false) {
    await Promise.all(
      adminIds.map((adminId) =>
        dispatchPushToUser(createPushPayload(input, event.id), {
          ...withCreatedBy(input.createdBy),
          operation: getAdminNotificationOperation(input.type),
          userId: adminId,
        }),
      ),
    );
  }

  return { id: event.id, ok: true, targetAdminCount: adminIds.length };
}
