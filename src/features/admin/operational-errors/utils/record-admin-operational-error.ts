import {
  ADMIN_OPERATIONAL_ERROR_CODES,
  ADMIN_OPERATIONAL_ERROR_FEATURES,
  ADMIN_OPERATIONAL_ERROR_OPERATIONS,
  ADMIN_OPERATIONAL_ERROR_STAGES,
  OPERATIONAL_ERROR_SEVERITY,
} from "@/features/operational-errors/constants";
import { recordOperationalError } from "@/features/operational-errors/record";
import {
  getOperationalErrorContext,
  type OperationalErrorContext,
} from "@/features/operational-errors/utils/get-operational-error-context";

type AdminOperationalErrorOperation =
  (typeof ADMIN_OPERATIONAL_ERROR_OPERATIONS)[keyof typeof ADMIN_OPERATIONAL_ERROR_OPERATIONS];

type AdminOperationalErrorStage =
  (typeof ADMIN_OPERATIONAL_ERROR_STAGES)[keyof typeof ADMIN_OPERATIONAL_ERROR_STAGES];

type AdminOperationalErrorCode =
  (typeof ADMIN_OPERATIONAL_ERROR_CODES)[keyof typeof ADMIN_OPERATIONAL_ERROR_CODES];

type RecordAdminOperationalErrorInput = {
  actorUserId: string;
  code: AdminOperationalErrorCode;
  context?: OperationalErrorContext;
  error: unknown;
  message: string;
  operation: AdminOperationalErrorOperation;
  stage: AdminOperationalErrorStage;
};

/**
 * 관리자 운영 오류 페이지에서 발생한 시스템 오류를 기록합니다.
 *
 * @param input 관리자 운영 오류 기록 정보
 */
export async function recordAdminOperationalError(
  input: RecordAdminOperationalErrorInput,
): Promise<void> {
  await recordOperationalError({
    actorUserId: input.actorUserId,
    errorCode: input.code,
    feature: ADMIN_OPERATIONAL_ERROR_FEATURES.ADMIN_OPERATIONAL_ERRORS,
    message: input.message,
    operation: input.operation,
    severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
    stage: input.stage,
    context: {
      ...input.context,
      error: getOperationalErrorContext(
        input.error,
        "Unknown admin operational error",
      ),
    },
  });
}
