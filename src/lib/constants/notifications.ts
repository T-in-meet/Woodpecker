export const NOTIFICATION_TYPES = {
  REVIEW: "REVIEW",
  SYSTEM: "SYSTEM",
} as const;

export const NOTIFICATION_STATUS = {
  SENT: "SENT",
  READ: "READ",
  SKIPPED: "SKIPPED",
} as const;

export type NotificationKindType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export type NotificationStatusType =
  (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];
