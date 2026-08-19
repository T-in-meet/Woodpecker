import {
  NOTE_CHAT_OPERATIONAL_ERROR_FEATURES,
  NOTE_CHAT_OPERATIONAL_ERROR_STAGES,
  type NoteChatOperationalErrorCodeType,
  type NoteChatOperationalErrorOperationType,
  type NoteChatOperationalErrorStageType,
  OPERATIONAL_ERROR_SEVERITY,
  type OperationalErrorSeverityType,
} from "@/features/operational-errors/constants";
import { reportOperationalError } from "@/features/operational-errors/report";
import type { Json } from "@/types/db.helpers";

/**
 * 노트 챗봇 운영 오류 보고 입력입니다.
 */
type ReportNoteChatOperationalErrorInput = {
  /** 오류를 발생시킨 사용자 ID */
  actorUserId?: string | null;

  /** 오류 분석에 필요한 추가 실행 정보 */
  context?: Record<string, Json>;

  /** 노트 챗봇 운영 오류 코드 */
  errorCode: NoteChatOperationalErrorCodeType;

  /** 원본 오류 */
  error: unknown;

  /** 동일 오류의 집계 범위를 세분화할 값 */
  fingerprintParts?: readonly string[];

  /** 관리자 운영 오류 화면에 표시할 메시지 */
  message: string;

  /** 노트 챗봇 운영 오류 작업 */
  operation: NoteChatOperationalErrorOperationType;

  /** 운영 오류 심각도 */
  severity?: OperationalErrorSeverityType;

  /** 오류가 발생한 작업 단계 */
  stage?: NoteChatOperationalErrorStageType;

  /** 오류의 영향을 받은 사용자 ID */
  userId?: string | null;
};

/**
 * 노트 챗봇에서 발생한 운영 오류를 기록하고 관리자에게 보고합니다.
 *
 * 공통 운영 오류 보고 계층을 사용하여 동일한 OPEN 오류는 집계하고,
 * 새로 생성된 조치 대상 오류에는 관리자 알림을 생성합니다.
 *
 * 운영 오류 보고 실패는 원래 노트 챗봇 기능의 오류 처리 흐름으로
 * 전파되지 않습니다.
 *
 * @param input 노트 챗봇 운영 오류 정보
 * @returns 운영 오류 보고 완료 Promise
 */
export async function reportNoteChatOperationalError(
  input: ReportNoteChatOperationalErrorInput,
) {
  await reportOperationalError({
    actorUserId: input.actorUserId ?? null,
    error: input.error,
    errorCode: input.errorCode,
    feature: NOTE_CHAT_OPERATIONAL_ERROR_FEATURES.NOTE_CHAT,
    message: input.message,
    operation: input.operation,
    severity: input.severity ?? OPERATIONAL_ERROR_SEVERITY.ERROR,
    stage: input.stage ?? NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
    userId: input.userId ?? null,
    ...(input.context !== undefined ? { context: input.context } : {}),
    ...(input.fingerprintParts !== undefined
      ? { fingerprintParts: input.fingerprintParts }
      : {}),
  });
}
