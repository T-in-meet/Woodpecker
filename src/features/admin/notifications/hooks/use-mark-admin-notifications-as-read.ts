import { useMutation, useQueryClient } from "@tanstack/react-query";

import { NOTIFICATIONS_QUERY_KEY } from "@/features/notifications/query-keys";

import {
  markAdminNotificationsAsReadAction,
  type MarkAdminNotificationsAsReadInput,
} from "../actions";
import { ADMIN_UNREAD_NOTIFICATION_COUNTS_QUERY_KEY } from "./use-admin-unread-notification-counts";

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

      void queryClient.invalidateQueries({
        queryKey: NOTIFICATIONS_QUERY_KEY.all,
      });
      void queryClient.invalidateQueries({
        queryKey: ADMIN_UNREAD_NOTIFICATION_COUNTS_QUERY_KEY.all,
      });
    },
  });
}
