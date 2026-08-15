import { useQuery } from "@tanstack/react-query";

import { getAdminUnreadNotificationCounts } from "../queries";
import { ADMIN_UNREAD_NOTIFICATION_COUNTS_QUERY_KEY } from "../query-keys";

export { ADMIN_UNREAD_NOTIFICATION_COUNTS_QUERY_KEY };

/**
 * 현재 관리자 기준 읽지 않은 관리자 알림 개수를 조회합니다.
 */
export function useAdminUnreadNotificationCounts() {
  return useQuery({
    queryFn: () => getAdminUnreadNotificationCounts(),
    queryKey: ADMIN_UNREAD_NOTIFICATION_COUNTS_QUERY_KEY.all,
  });
}
