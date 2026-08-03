/**
 * 관리자 알림 목록 query key factory입니다.
 */
export const ADMIN_NOTIFICATIONS_QUERY_KEY = {
  all: ["admin-notifications"] as const,

  user: (adminUserId: string) =>
    [...ADMIN_NOTIFICATIONS_QUERY_KEY.all, adminUserId] as const,
};

/**
 * 관리자 알림 unread count query key factory입니다.
 */
export const ADMIN_UNREAD_NOTIFICATION_COUNTS_QUERY_KEY = {
  all: ["admin-unread-notification-counts"] as const,
};
