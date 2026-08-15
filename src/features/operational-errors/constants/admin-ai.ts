/**
 * 관리자 AI 운영 오류 feature입니다.
 */
export const ADMIN_AI_OPERATIONAL_ERROR_FEATURE = "admin-ai";

/**
 * 관리자 AI 운영 오류 코드입니다.
 */
export const ADMIN_AI_OPERATIONAL_ERROR_CODE = {
  LIST_RESPONSE_INVALID: "ADMIN_AI_LIST_RESPONSE_INVALID",
  MODEL_CONFIG_CREATE_FAILED: "ADMIN_AI_MODEL_CONFIG_CREATE_FAILED",
  MODEL_CONFIG_DELETE_FAILED: "ADMIN_AI_MODEL_CONFIG_DELETE_FAILED",
  MODEL_CONFIG_LOAD_FAILED: "ADMIN_AI_MODEL_CONFIG_LOAD_FAILED",
  MODEL_CONFIG_UPDATE_FAILED: "ADMIN_AI_MODEL_CONFIG_UPDATE_FAILED",
} as const;

/**
 * 관리자 AI 운영 오류 작업입니다.
 */
export const ADMIN_AI_OPERATIONAL_ERROR_OPERATION = {
  CREATE_MODEL_CONFIG: "create_model_config",
  DELETE_MODEL_CONFIG: "delete_model_config",
  GET_MODEL_CONFIG: "get_model_config",
  GET_MODEL_CONFIG_OPTIONS: "get_model_config_options",
  UPDATE_MODEL_CONFIG: "update_model_config",
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
  [ADMIN_AI_OPERATIONAL_ERROR_OPERATION.CREATE_MODEL_CONFIG]: "AI 모델 생성",
  [ADMIN_AI_OPERATIONAL_ERROR_OPERATION.DELETE_MODEL_CONFIG]: "AI 모델 삭제",
  [ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_MODEL_CONFIG]: "AI 모델 조회",
  [ADMIN_AI_OPERATIONAL_ERROR_OPERATION.GET_MODEL_CONFIG_OPTIONS]:
    "AI 모델 선택 목록 조회",
  [ADMIN_AI_OPERATIONAL_ERROR_OPERATION.UPDATE_MODEL_CONFIG]: "AI 모델 수정",
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
  [ADMIN_AI_OPERATIONAL_ERROR_CODE.MODEL_CONFIG_CREATE_FAILED]:
    "AI 모델 생성 실패",
  [ADMIN_AI_OPERATIONAL_ERROR_CODE.MODEL_CONFIG_DELETE_FAILED]:
    "AI 모델 삭제 실패",
  [ADMIN_AI_OPERATIONAL_ERROR_CODE.MODEL_CONFIG_LOAD_FAILED]:
    "AI 모델 조회 실패",
  [ADMIN_AI_OPERATIONAL_ERROR_CODE.MODEL_CONFIG_UPDATE_FAILED]:
    "AI 모델 수정 실패",
} as const;
