export const NOTIFICATION_TYPES = {
  FEEDBACK_REPLY: "FEEDBACK_REPLY",
  REVIEW: "REVIEW",
  SYSTEM: "SYSTEM",
} as const;

export const ADMIN_NOTIFICATION_TYPES = {
  FEEDBACK_CREATED: "FEEDBACK_CREATED",
  OPERATIONAL_ERROR: "OPERATIONAL_ERROR",
} as const;

export const NOTIFICATION_STATUS = {
  SENT: "SENT",
  READ: "READ",
} as const;

export type NotificationKindType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export type AdminNotificationKindType =
  (typeof ADMIN_NOTIFICATION_TYPES)[keyof typeof ADMIN_NOTIFICATION_TYPES];

export type NotificationStatusType =
  (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];

/**
 * 알림 일정을 직접 옮길 수 있는 최대 일수(오늘 기준).
 * 달력의 선택 가능 범위이자 `update_notification_schedule` RPC가 재검증하는 값이다.
 * 값을 바꾸면 마이그레이션의 검증 범위도 함께 바꿔야 한다.
 */
export const MAX_NOTIFICATION_SCHEDULE_OFFSET_DAYS = 30;
