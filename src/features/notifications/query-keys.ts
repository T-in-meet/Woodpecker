/**
 * 헤더 알림 query key factory입니다.
 */
export const NOTIFICATIONS_QUERY_KEY = {
  all: ["notifications"] as const,

  user: (userId: string) => [...NOTIFICATIONS_QUERY_KEY.all, userId] as const,
};
