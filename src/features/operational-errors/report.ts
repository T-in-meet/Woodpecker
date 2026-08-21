import { createAdminNotification } from "@/features/notifications/create-admin-notification";
import { buildAdminOperationalErrorNotificationDefinition } from "@/features/notifications/definitions";
import { ADMIN_NOTIFICATION_TYPES } from "@/lib/constants/notifications";
import { logError } from "@/lib/logger";

import {
  OPERATIONAL_ERROR_OPERATIONS,
  OPERATIONAL_ERROR_SEVERITY,
} from "./constants";
import {
  recordOperationalError,
  type RecordOperationalErrorInput,
  type RecordOperationalErrorOptions,
  type RecordOperationalErrorResult,
} from "./record";

type CreatedOperationalErrorResult = Extract<
  RecordOperationalErrorResult,
  { ok: true }
> & {
  id: string;
  recorded: "created";
};

/**
 * 운영 오류 보고 동작을 제어하는 옵션입니다.
 */
export type ReportOperationalErrorOptions = RecordOperationalErrorOptions & {
  /**
   * 운영 오류가 새로 생성됐을 때 관리자 알림을 생성할지 여부입니다.
   *
   * 기록은 필요하지만 관리자 알림으로 확산하면 안 되는 내부 처리에는 false를 사용합니다.
   */
  notifyAdmins?: boolean;
};

function shouldCreateAdminNotification(
  input: RecordOperationalErrorInput,
  result: RecordOperationalErrorResult,
  options: ReportOperationalErrorOptions,
): result is CreatedOperationalErrorResult {
  if (options.notifyAdmins === false) return false;
  if (!result.ok || result.recorded !== "created" || !result.id) return false;
  if (input.severity === OPERATIONAL_ERROR_SEVERITY.INFO) return false;

  return (
    input.operation !==
    OPERATIONAL_ERROR_OPERATIONS.CREATE_ADMIN_OPERATIONAL_ERROR_NOTIFICATION
  );
}

/**
 * 운영 오류를 기록하고, 새로 생성된 조치 대상 오류는 관리자 알림으로 보고합니다.
 *
 * recordOperationalError는 저장과 집계만 담당하고, 이 함수는 관리자 알림 생성이라는
 * 부수 효과를 조합합니다. 관리자 알림 생성 실패는 원래 기능 흐름을 막지 않으며,
 * 반환값은 운영 오류 기록 결과를 그대로 유지합니다.
 *
 * @param input 기록하고 보고할 운영 오류 정보
 * @param options 기록 Client와 관리자 알림 생성 여부를 제어하는 옵션
 * @returns 운영 오류 생성 또는 집계 결과
 */
export async function reportOperationalError(
  input: RecordOperationalErrorInput,
  options: ReportOperationalErrorOptions = {},
): Promise<RecordOperationalErrorResult> {
  const result = await recordOperationalError(input, options);

  if (!shouldCreateAdminNotification(input, result, options)) {
    return result;
  }

  const definition = buildAdminOperationalErrorNotificationDefinition({
    operationalErrorId: result.id,
  });

  try {
    const notificationResult = await createAdminNotification({
      body: `${input.feature} / ${input.operation} / ${input.stage}`,
      clickPath: definition.clickPath,
      createdBy: input.actorUserId ?? null,
      metadata: {
        errorCode: input.errorCode,
        feature: input.feature,
        operation: input.operation,
        operationalErrorId: result.id,
        severity: input.severity ?? OPERATIONAL_ERROR_SEVERITY.ERROR,
        stage: input.stage,
      },
      pushEnabled: definition.pushEnabled,
      title: input.message,
      type: ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
    });

    if (!notificationResult.ok) {
      logError({
        error: notificationResult.error,
        event: "operationalErrors.report.adminNotificationFailed",
        failureStage: notificationResult.failureStage,
        operationalErrorRecorded: notificationResult.operationalErrorRecorded,
        operationalErrorId: result.id,
      });
    }
  } catch (error) {
    logError({
      error,
      event: "operationalErrors.report.adminNotificationFailed",
      operationalErrorId: result.id,
    });
  }

  return result;
}
