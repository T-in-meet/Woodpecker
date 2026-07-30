import { useQuery } from "@tanstack/react-query";

import { getAdminUnreadNotificationCounts } from "../queries";

/**
 * 관리자 알림 unread count query key factory입니다.
 */
export const ADMIN_UNREAD_NOTIFICATION_COUNTS_QUERY_KEY = {
  all: ["admin-unread-notification-counts"] as const,
};

/**
 * 현재 관리자 기준 읽지 않은 관리자 알림 개수를 조회합니다.
 */
export function useAdminUnreadNotificationCounts() {
  return useQuery({
    queryFn: () => getAdminUnreadNotificationCounts(),
    queryKey: ADMIN_UNREAD_NOTIFICATION_COUNTS_QUERY_KEY.all,
  });
}
