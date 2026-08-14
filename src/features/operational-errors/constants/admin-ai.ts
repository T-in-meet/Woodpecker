/**
 * 관리자 AI 운영 오류 feature입니다.
 */
export const ADMIN_AI_OPERATIONAL_ERROR_FEATURE = "admin-ai";

/**
 * 관리자 AI 공통 운영 오류 코드입니다.
 */
export const ADMIN_AI_OPERATIONAL_ERROR_CODE = {
  LIST_RESPONSE_INVALID: "ADMIN_AI_LIST_RESPONSE_INVALID",
} as const;

/**
 * 관리자 AI 공통 운영 오류 작업입니다.
 */
export const ADMIN_AI_OPERATIONAL_ERROR_OPERATION = {
  VALIDATE_LIST_RESPONSE: "validate_list_response",
} as const;

/**
 * 관리자 AI 운영 오류 단계입니다.
 */
export const ADMIN_AI_OPERATIONAL_ERROR_STAGE = {
  DATABASE: "database",
  VALIDATION: "validation",
} as const;

/**
 * 관리자 AI 운영 오류 코드 타입입니다.
 */
export type AdminAiOperationalErrorCode =
  (typeof ADMIN_AI_OPERATIONAL_ERROR_CODE)[keyof typeof ADMIN_AI_OPERATIONAL_ERROR_CODE];

/**
 * 관리자 AI 운영 오류 작업 타입입니다.
 */
export type AdminAiOperationalErrorOperation =
  (typeof ADMIN_AI_OPERATIONAL_ERROR_OPERATION)[keyof typeof ADMIN_AI_OPERATIONAL_ERROR_OPERATION];

/**
 * 관리자 AI 운영 오류 단계 타입입니다.
 */
export type AdminAiOperationalErrorStage =
  (typeof ADMIN_AI_OPERATIONAL_ERROR_STAGE)[keyof typeof ADMIN_AI_OPERATIONAL_ERROR_STAGE];

/**
 * 관리자 AI 운영 오류 기능의 표시 이름입니다.
 */
export const ADMIN_AI_OPERATIONAL_ERROR_FEATURE_LABELS = {
  [ADMIN_AI_OPERATIONAL_ERROR_FEATURE]: "관리자 AI",
} as const;

/**
 * 관리자 AI 운영 오류 작업의 표시 이름입니다.
 */
export const ADMIN_AI_OPERATIONAL_ERROR_OPERATION_LABELS = {
  [ADMIN_AI_OPERATIONAL_ERROR_OPERATION.VALIDATE_LIST_RESPONSE]:
    "AI 목록 응답 검증",
} as const;

/**
 * 관리자 AI 운영 오류 단계의 표시 이름입니다.
 */
export const ADMIN_AI_OPERATIONAL_ERROR_STAGE_LABELS = {
  [ADMIN_AI_OPERATIONAL_ERROR_STAGE.DATABASE]: "데이터베이스",
  [ADMIN_AI_OPERATIONAL_ERROR_STAGE.VALIDATION]: "검증",
} as const;

/**
 * 관리자 AI 운영 오류 코드의 표시 이름입니다.
 */
export const ADMIN_AI_OPERATIONAL_ERROR_CODE_LABELS = {
  [ADMIN_AI_OPERATIONAL_ERROR_CODE.LIST_RESPONSE_INVALID]:
    "AI 목록 응답 검증 실패",
} as const;
