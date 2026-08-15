import {
  AI_OPERATIONAL_ERROR_FEATURE,
  type AiOperationalErrorCode,
  type AiOperationalErrorOperation,
  type AiOperationalErrorStage,
  OPERATIONAL_ERROR_SEVERITY,
  type OperationalErrorSeverityType,
} from "@/features/operational-errors/constants";
import {
  reportOperationalError,
  type ReportOperationalErrorOptions,
} from "@/features/operational-errors/report";
import type { Json } from "@/types/db.helpers";

/**
 * AI Foundation 운영 오류 context에 저장할 수 있는 객체 형태입니다.
 */
type AiOperationalErrorContext = Record<string, Json>;

/**
 * 공통 운영 오류 보고 함수에 전달할 입력 타입입니다.
 *
 * 공통 보고 함수의 입력 타입을 직접 참조하여
 * AI 전용 입력을 변환할 때 타입 정합성을 유지합니다.
 */
type SharedOperationalErrorInput = Parameters<typeof reportOperationalError>[0];

/**
 * AI Foundation 운영 오류 보고 입력입니다.
 *
 * AI 기능에서 사용하는 오류 코드와 operation/stage를 AI 전용 타입으로 제한하고,
 * 실제 기록과 관리자 알림 생성은 공통 운영 오류 보고 기능에 위임합니다.
 */
export type ReportAiOperationalErrorInput = {
  actorUserId?: string | null;
  context?: AiOperationalErrorContext;
  error?: unknown;
  errorCode: AiOperationalErrorCode;
  fingerprintParts?: readonly string[];
  message: string;
  operation: AiOperationalErrorOperation;
  severity?: OperationalErrorSeverityType;
  stage: AiOperationalErrorStage;
  userId?: string | null;
};

/**
 * AI Foundation에서 발생한 운영 오류를 공통 운영 오류 기능에 보고합니다.
 *
 * AI 전용 오류 정보를 공통 운영 오류 입력으로 변환하고,
 * feature를 AI Foundation으로 고정하며 기본 severity를 적용합니다.
 *
 * 실제 오류 저장과 동일 오류 집계, 필요한 관리자 알림 생성은
 * `reportOperationalError`에 위임합니다.
 *
 * @param input AI Foundation 운영 오류 보고에 필요한 정보
 * @param options 공통 운영 오류 보고 동작을 제어하는 옵션
 * @returns 운영 오류 생성 또는 집계 결과
 */
export async function reportAiOperationalError(
  input: ReportAiOperationalErrorInput,
  options: ReportOperationalErrorOptions = {},
) {
  // AI 호출자가 공통 feature를 임의로 변경하지 못하도록 AI 도메인으로 고정한다.
  const sharedInput: SharedOperationalErrorInput = {
    actorUserId: input.actorUserId ?? null,
    errorCode: input.errorCode,
    feature: AI_OPERATIONAL_ERROR_FEATURE,
    message: input.message,
    operation: input.operation,
    severity: input.severity ?? OPERATIONAL_ERROR_SEVERITY.ERROR,
    stage: input.stage,
    userId: input.userId ?? null,
  };

  // optional 값은 실제로 전달된 경우에만 포함하여
  // 미지정 상태와 명시적으로 전달된 값을 구분한다.
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
