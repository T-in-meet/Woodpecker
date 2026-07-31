/**
 * 운영 오류 관리자 기능에서 사용하는 운영 오류 기능 값입니다.
 */
export const ADMIN_OPERATIONAL_ERROR_FEATURES = {
  ADMIN_OPERATIONAL_ERRORS: "admin_operational_errors",
} as const;

/**
 * 운영 오류 관리자 기능의 표시 이름입니다.
 */
export const ADMIN_OPERATIONAL_ERROR_FEATURE_LABELS = {
  admin_operational_errors: "운영 오류 관리",
} as const;

/**
 * 운영 오류 관리자 기능에서 오류가 발생할 수 있는 작업입니다.
 */
export const ADMIN_OPERATIONAL_ERROR_OPERATIONS = {
  GET_OPERATIONAL_ERROR_DETAIL: "get_operational_error_detail",
  LIST_OPERATIONAL_ERRORS: "list_operational_errors",
  UPDATE_OPERATIONAL_ERROR_STATUS: "update_operational_error_status",
} as const;

/**
 * 운영 오류 관리자 작업의 표시 이름입니다.
 */
export const ADMIN_OPERATIONAL_ERROR_OPERATION_LABELS = {
  get_operational_error_detail: "운영 오류 상세 조회",
  list_operational_errors: "운영 오류 목록 조회",
  update_operational_error_status: "운영 오류 상태 변경",
} as const;

/**
 * 운영 오류 관리자 작업 내부에서 오류가 발생할 수 있는 세부 단계입니다.
 */
export const ADMIN_OPERATIONAL_ERROR_STAGES = {
  CURRENT_STATUS_QUERY: "current_status_query",
  DETAIL_QUERY: "detail_query",
  HISTORY_QUERY: "history_query",
  LIST_QUERY: "list_query",
  PROFILE_QUERY: "profile_query",
  STATUS_HISTORY_INSERT: "status_history_insert",
  STATUS_UPDATE: "status_update",
} as const;

/**
 * 운영 오류 관리자 작업 단계의 표시 이름입니다.
 */
export const ADMIN_OPERATIONAL_ERROR_STAGE_LABELS = {
  current_status_query: "현재 상태 조회",
  detail_query: "상세 조회",
  history_query: "처리 이력 조회",
  list_query: "목록 조회",
  profile_query: "사용자 정보 조회",
  status_history_insert: "처리 이력 저장",
  status_update: "상태 변경",
} as const;

/**
 * 운영 오류 관리자 기능의 운영 오류 코드입니다.
 */
export const ADMIN_OPERATIONAL_ERROR_CODES = {
  OPERATIONAL_ERROR_DETAIL_FAILED: "OPERATIONAL_ERROR_DETAIL_FAILED",
  OPERATIONAL_ERROR_HISTORY_FAILED: "OPERATIONAL_ERROR_HISTORY_FAILED",
  OPERATIONAL_ERROR_HISTORY_INSERT_FAILED:
    "OPERATIONAL_ERROR_HISTORY_INSERT_FAILED",
  OPERATIONAL_ERROR_LIST_FAILED: "OPERATIONAL_ERROR_LIST_FAILED",
  OPERATIONAL_ERROR_PROFILES_FAILED: "OPERATIONAL_ERROR_PROFILES_FAILED",
  OPERATIONAL_ERROR_STATUS_QUERY_FAILED:
    "OPERATIONAL_ERROR_STATUS_QUERY_FAILED",
  OPERATIONAL_ERROR_STATUS_UPDATE_FAILED:
    "OPERATIONAL_ERROR_STATUS_UPDATE_FAILED",
} as const;

/**
 * 운영 오류 관리자 오류 코드의 표시 이름입니다.
 */
export const ADMIN_OPERATIONAL_ERROR_CODE_LABELS = {
  OPERATIONAL_ERROR_DETAIL_FAILED: "운영 오류 상세 조회 실패",
  OPERATIONAL_ERROR_HISTORY_FAILED: "운영 오류 처리 이력 조회 실패",
  OPERATIONAL_ERROR_HISTORY_INSERT_FAILED: "운영 오류 처리 이력 저장 실패",
  OPERATIONAL_ERROR_LIST_FAILED: "운영 오류 목록 조회 실패",
  OPERATIONAL_ERROR_PROFILES_FAILED: "운영 오류 사용자 정보 조회 실패",
  OPERATIONAL_ERROR_STATUS_QUERY_FAILED: "운영 오류 현재 상태 조회 실패",
  OPERATIONAL_ERROR_STATUS_UPDATE_FAILED: "운영 오류 상태 변경 실패",
} as const;
