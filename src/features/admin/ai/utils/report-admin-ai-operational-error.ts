import {
  ADMIN_AI_OPERATIONAL_ERROR_FEATURE,
  type AdminAiOperationalErrorCode,
  type AdminAiOperationalErrorOperation,
  type AdminAiOperationalErrorStage,
  OPERATIONAL_ERROR_SEVERITY,
  type OperationalErrorSeverityType,
} from "@/features/operational-errors/constants";
import {
  reportOperationalError,
  type ReportOperationalErrorOptions,
} from "@/features/operational-errors/report";
import type { Json } from "@/types/db.helpers";

type AdminAiOperationalErrorContext = Record<string, Json>;

type SharedOperationalErrorInput = Parameters<typeof reportOperationalError>[0];

/**
 * 관리자 AI 운영 오류 보고 입력입니다.
 *
 * 관리자 AI 기능에서 사용하는 오류 코드와 operation/stage를
 * 관리자 AI 전용 타입으로 제한합니다.
 */
export type ReportAdminAiOperationalErrorInput = {
  actorUserId?: string | null;
  context?: AdminAiOperationalErrorContext;
  error?: unknown;
  errorCode: AdminAiOperationalErrorCode;
  fingerprintParts?: readonly string[];
  message: string;
  operation: AdminAiOperationalErrorOperation;
  severity?: OperationalErrorSeverityType;
  stage: AdminAiOperationalErrorStage;
  userId?: string | null;
};

/**
 * 관리자 AI 운영 오류를 공유 operational-errors 기능을 통해 보고합니다.
 *
 * feature는 관리자 AI 전용 값으로 고정하고,
 * 실제 오류 저장과 집계 및 필요한 관리자 알림 처리는
 * 공유 `reportOperationalError`에 위임합니다.
 *
 * @param input 관리자 AI 운영 오류 정보
 * @param options 공유 operational-errors 보고 옵션
 * @returns 공유 operational-errors 기능의 보고 결과
 */
export async function reportAdminAiOperationalError(
  input: ReportAdminAiOperationalErrorInput,
  options: ReportOperationalErrorOptions = {},
) {
  const sharedInput: SharedOperationalErrorInput = {
    actorUserId: input.actorUserId ?? null,
    errorCode: input.errorCode,
    feature: ADMIN_AI_OPERATIONAL_ERROR_FEATURE,
    message: input.message,
    operation: input.operation,
    severity: input.severity ?? OPERATIONAL_ERROR_SEVERITY.ERROR,
    stage: input.stage,
    userId: input.userId ?? null,
  };

  // 호출자가 실제로 전달한 optional 정보만 공유 입력에 포함한다.
  if (input.context !== undefined) {
    sharedInput.context = input.context;
  }

  if (input.error !== undefined) {
    sharedInput.error = input.error;
  }

  if (input.fingerprintParts !== undefined) {
    sharedInput.fingerprintParts = input.fingerprintParts;
  }

  return reportOperationalError(sharedInput, options);
}
