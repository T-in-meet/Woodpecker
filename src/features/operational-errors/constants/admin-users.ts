/**
 * 관리자 사용자 기능에서 사용하는 운영 오류 기능 값입니다.
 */
export const ADMIN_USER_OPERATIONAL_ERROR_FEATURES = {
  ADMIN_USERS: "admin_users",
} as const;

/**
 * 관리자 사용자 기능의 표시 이름입니다.
 */
export const ADMIN_USER_OPERATIONAL_ERROR_FEATURE_LABELS = {
  admin_users: "관리자 사용자",
} as const;

/**
 * 관리자 사용자 기능에서 오류가 발생할 수 있는 작업입니다.
 */
export const ADMIN_USER_OPERATIONAL_ERROR_OPERATIONS = {
  GET_ADMIN_USERS: "get_admin_users",
  UPDATE_ADMIN_USER_ROLE: "update_admin_user_role",
} as const;

/**
 * 관리자 사용자 작업의 표시 이름입니다.
 */
export const ADMIN_USER_OPERATIONAL_ERROR_OPERATION_LABELS = {
  get_admin_users: "관리자 사용자 목록 조회",
  update_admin_user_role: "관리자 사용자 역할 변경",
} as const;

/**
 * 관리자 사용자 작업 내부에서 오류가 발생할 수 있는 세부 단계입니다.
 */
export const ADMIN_USER_OPERATIONAL_ERROR_STAGES = {
  USER_LIST_QUERY: "admin_user_list_query",
  TARGET_USER_LOAD: "admin_user_target_load",
  USER_ROLE_UPDATE: "admin_user_role_update",
} as const;

/**
 * 관리자 사용자 작업 단계의 표시 이름입니다.
 */
export const ADMIN_USER_OPERATIONAL_ERROR_STAGE_LABELS = {
  admin_user_list_query: "사용자 목록 조회",
  admin_user_target_load: "대상 사용자 조회",
  admin_user_role_update: "사용자 역할 변경",
} as const;

/**
 * 관리자 사용자 기능의 운영 오류 코드입니다.
 */
export const ADMIN_USER_OPERATIONAL_ERROR_CODES = {
  ADMIN_USERS_LOAD_FAILED: "ADMIN_USERS_LOAD_FAILED",
  ADMIN_USER_ROLE_TARGET_LOAD_FAILED: "ADMIN_USER_ROLE_TARGET_LOAD_FAILED",
  ADMIN_USER_ROLE_UPDATE_FAILED: "ADMIN_USER_ROLE_UPDATE_FAILED",
} as const;

/**
 * 관리자 사용자 오류 코드의 표시 이름입니다.
 */
export const ADMIN_USER_OPERATIONAL_ERROR_CODE_LABELS = {
  ADMIN_USERS_LOAD_FAILED: "관리자 사용자 목록 조회 실패",
  ADMIN_USER_ROLE_TARGET_LOAD_FAILED: "역할 변경 대상 사용자 조회 실패",
  ADMIN_USER_ROLE_UPDATE_FAILED: "관리자 사용자 역할 변경 실패",
} as const;
