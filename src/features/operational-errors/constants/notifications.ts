/**
 * 알림 기능에서 사용하는 운영 오류 기능 값입니다.
 */
export const NOTIFICATION_OPERATIONAL_ERROR_FEATURES = {
  NOTIFICATIONS: "notifications",
} as const;

/**
 * 알림 기능의 표시 이름입니다.
 */
export const NOTIFICATION_OPERATIONAL_ERROR_FEATURE_LABELS = {
  notifications: "알림",
} as const;

/**
 * 알림 기능에서 오류가 발생할 수 있는 작업입니다.
 */
export const NOTIFICATION_OPERATIONAL_ERROR_OPERATIONS = {
  CREATE_USER_NOTIFICATION: "create_user_notification",
  DISPATCH_PUSH: "dispatch_push",
} as const;

/**
 * 알림 작업의 표시 이름입니다.
 */
export const NOTIFICATION_OPERATIONAL_ERROR_OPERATION_LABELS = {
  create_user_notification: "사용자 알림 생성",
  dispatch_push: "푸시 알림 전송",
} as const;

/**
 * 알림 작업 내부에서 오류가 발생할 수 있는 세부 단계입니다.
 */
export const NOTIFICATION_OPERATIONAL_ERROR_STAGES = {
  IN_APP_NOTIFICATION_CREATE: "in_app_notification_create",
  PUSH_SEND: "push_send",
  PUSH_SUBSCRIPTION_CLEANUP: "push_subscription_cleanup",
} as const;

/**
 * 알림 작업 단계의 표시 이름입니다.
 */
export const NOTIFICATION_OPERATIONAL_ERROR_STAGE_LABELS = {
  in_app_notification_create: "인앱 알림 생성",
  push_send: "푸시 전송",
  push_subscription_cleanup: "푸시 구독 정리",
} as const;

/**
 * 알림 기능의 운영 오류 코드입니다.
 */
export const NOTIFICATION_OPERATIONAL_ERROR_CODES = {
  NOTIFICATION_CREATE_FAILED: "NOTIFICATION_CREATE_FAILED",
  PUSH_SEND_FAILED: "PUSH_SEND_FAILED",
  PUSH_SUBSCRIPTION_DELETE_FAILED: "PUSH_SUBSCRIPTION_DELETE_FAILED",
  PUSH_SUBSCRIPTION_GONE: "PUSH_SUBSCRIPTION_GONE",
} as const;

/**
 * 알림 오류 코드의 표시 이름입니다.
 */
export const NOTIFICATION_OPERATIONAL_ERROR_CODE_LABELS = {
  NOTIFICATION_CREATE_FAILED: "사용자 알림 생성 실패",
  PUSH_SEND_FAILED: "푸시 알림 전송 실패",
  PUSH_SUBSCRIPTION_DELETE_FAILED: "푸시 구독 삭제 실패",
  PUSH_SUBSCRIPTION_GONE: "만료된 푸시 구독 감지",
} as const;
