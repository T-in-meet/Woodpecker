/**
 * 운영 오류의 처리 상태입니다.
 *
 * OPEN: 아직 확인되지 않은 오류
 * RESOLVED: 원인을 확인하고 해결한 오류
 * IGNORED: 확인했지만 별도 조치가 필요하지 않은 오류
 */
export const OPERATIONAL_ERROR_STATUS = {
  IGNORED: "IGNORED",
  OPEN: "OPEN",
  RESOLVED: "RESOLVED",
} as const;

/**
 * 운영 오류의 심각도입니다.
 */
export const OPERATIONAL_ERROR_SEVERITY = {
  ERROR: "ERROR",
  INFO: "INFO",
  WARN: "WARN",
} as const;

/**
 * 운영 오류가 발생한 기능(도메인)입니다.
 */
export const OPERATIONAL_ERROR_FEATURES = {
  NOTIFICATIONS: "notifications",
} as const;

/**
 * 오류가 발생한 작업(Operation)입니다.
 */
export const OPERATIONAL_ERROR_OPERATIONS = {
  CREATE_USER_NOTIFICATION: "create_user_notification",
  DISPATCH_PUSH: "dispatch_push",
} as const;

/**
 * 작업 내부에서 오류가 발생한 세부 단계입니다.
 */
export const OPERATIONAL_ERROR_STAGES = {
  IN_APP_NOTIFICATION_CREATE: "in_app_notification_create",
  PUSH_SEND: "push_send",
  PUSH_SUBSCRIPTION_CLEANUP: "push_subscription_cleanup",
} as const;

/**
 * 운영 오류를 식별하기 위한 고유 코드입니다.
 *
 * 동일한 원인의 오류는 항상 같은 코드를 사용합니다.
 */
export const OPERATIONAL_ERROR_CODES = {
  NOTIFICATION_CREATE_FAILED: "NOTIFICATION_CREATE_FAILED",
  PUSH_SEND_FAILED: "PUSH_SEND_FAILED",
  PUSH_SUBSCRIPTION_DELETE_FAILED: "PUSH_SUBSCRIPTION_DELETE_FAILED",
  PUSH_SUBSCRIPTION_GONE: "PUSH_SUBSCRIPTION_GONE",
} as const;

/**
 * 운영 오류의 처리 상태 타입입니다.
 */
export type OperationalErrorStatusType =
  (typeof OPERATIONAL_ERROR_STATUS)[keyof typeof OPERATIONAL_ERROR_STATUS];

/**
 * 운영 오류의 심각도 타입입니다.
 */
export type OperationalErrorSeverityType =
  (typeof OPERATIONAL_ERROR_SEVERITY)[keyof typeof OPERATIONAL_ERROR_SEVERITY];
