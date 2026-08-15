import {
  ADMIN_AI_OPERATIONAL_ERROR_STAGE,
  type AdminAiOperationalErrorCode,
  type AdminAiOperationalErrorOperation,
  type AdminAiOperationalErrorStage,
} from "@/features/operational-errors/constants";
import type { Json } from "@/types/db.helpers";

import { reportAdminAiOperationalError } from "./report-admin-ai-operational-error";

type ReportAdminAiActionErrorInput = {
  /** 현재 관리자 사용자 ID */
  adminUserId: string;

  /** 오류 분석에 필요한 추가 실행 정보 */
  context?: Record<string, Json>;

  /** 관리자 AI 운영 오류 코드 */
  errorCode: AdminAiOperationalErrorCode;

  /** 동일 오류 집계를 세분화할 값 */
  fingerprintParts?: readonly string[];

  /** 관리자 운영 오류 화면에 표시할 메시지 */
  message: string;

  /** 관리자 AI 운영 오류 작업 */
  operation: AdminAiOperationalErrorOperation;

  /** 원본 오류 */
  error: unknown;

  /** 관리자 AI 운영 오류 단계 */
  stage?: AdminAiOperationalErrorStage;
};

/**
 * 관리자 AI 서버 액션 실패를 운영 오류로 보고합니다.
 *
 * 관리자 ID를 오류 발생 actor로 전달하고,
 * 별도의 stage가 지정되지 않으면 데이터베이스 단계로 보고합니다.
 *
 * 실제 오류 저장과 집계, 필요한 관리자 알림 생성은
 * `reportAdminAiOperationalError`에 위임합니다.
 *
 * @param input 관리자 AI 서버 액션 오류 정보
 */
export async function reportAdminAiActionError(
  input: ReportAdminAiActionErrorInput,
) {
  await reportAdminAiOperationalError({
    actorUserId: input.adminUserId,
    error: input.error,
    errorCode: input.errorCode,
    message: input.message,
    operation: input.operation,
    stage: input.stage ?? ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE,
    ...(input.context !== undefined ? { context: input.context } : {}),
    ...(input.fingerprintParts !== undefined
      ? { fingerprintParts: input.fingerprintParts }
      : {}),
  });
}
