/**
 * 운영 오류 관리자 기능에서 사용하는 운영 오류 기능 값입니다.
 */
export const ADMIN_OPERATIONAL_ERROR_FEATURES = {
  ADMIN_OPERATIONAL_ERRORS: "admin_operational_errors",
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
