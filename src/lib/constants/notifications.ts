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
