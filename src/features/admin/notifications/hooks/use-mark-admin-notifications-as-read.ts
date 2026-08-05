import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  markAdminNotificationsAsReadAction,
  type MarkAdminNotificationsAsReadInput,
  markAllAdminNotificationsAsReadAction,
} from "../actions";
import {
  ADMIN_NOTIFICATIONS_QUERY_KEY,
  ADMIN_UNREAD_NOTIFICATION_COUNTS_QUERY_KEY,
} from "../query-keys";

/**
 * 관리자 알림 관련 query cache를 갱신합니다.
 *
 * @param queryClient TanStack Query client
 */
function invalidateAdminNotificationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  void queryClient.invalidateQueries({
    queryKey: ADMIN_NOTIFICATIONS_QUERY_KEY.all,
  });
  void queryClient.invalidateQueries({
    queryKey: ADMIN_UNREAD_NOTIFICATION_COUNTS_QUERY_KEY.all,
  });
}

/**
 * 현재 관리자 기준 특정 관리자 알림 이벤트들을 읽음 처리합니다.
 *
 * 성공 시 헤더 알림 목록과 관리자 사이드바 badge count를 함께 갱신합니다.
 */
export function useMarkAdminNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: MarkAdminNotificationsAsReadInput) =>
      markAdminNotificationsAsReadAction(input),
    onSuccess: (result) => {
      if (!result.ok) return;

      invalidateAdminNotificationQueries(queryClient);
    },
  });
}

/**
 * 현재 관리자 기준 모든 관리자 알림을 읽음 처리합니다.
 *
 * 성공 시 관리자 알림 Bell과 관리자 사이드바 badge count를 함께 갱신합니다.
 */
export function useMarkAllAdminNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllAdminNotificationsAsReadAction(),
    onSuccess: (result) => {
      if (!result.ok) return;

      invalidateAdminNotificationQueries(queryClient);
    },
  });
}
