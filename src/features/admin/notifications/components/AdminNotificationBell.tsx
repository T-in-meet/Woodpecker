"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  getAdminNotificationList,
  getAdminUnreadNotificationCounts,
} from "@/features/admin/notifications/queries";
import { cn } from "@/lib/utils/cn";

import { useAdminUnreadNotificationCounts } from "../hooks/use-admin-unread-notification-counts";
import { useMarkAllAdminNotificationsAsRead } from "../hooks/use-mark-admin-notifications-as-read";
import { ADMIN_NOTIFICATIONS_QUERY_KEY } from "../query-keys";
import {
  AdminNotificationList,
  type AdminNotificationListItemType,
} from "./AdminNotificationList";

const ADMIN_NOTIFICATION_LIST_LIMIT = 20;

type AdminNotificationBellProps = {
  adminUserId: string;
};

/**
 * 관리자 알림 타입별 count map을 총 unread count로 합산합니다.
 *
 * @param counts 관리자 알림 타입별 unread count
 * @returns 전체 관리자 unread count
 */
function sumAdminUnreadCounts(
  counts: Awaited<ReturnType<typeof getAdminUnreadNotificationCounts>>,
) {
  return Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0);
}

/**
 * 관리자 Bell에서 사용할 알림 목록을 조회합니다.
 *
 * @returns 관리자 알림 목록
 */
async function fetchAdminNotificationList(): Promise<
  AdminNotificationListItemType[]
> {
  const items = await getAdminNotificationList({
    limit: ADMIN_NOTIFICATION_LIST_LIMIT,
  });

  return items.filter(isAdminNotificationListItem);
}

/**
 * 관리자 알림 item이 관리자 전용 목록 item인지 확인합니다.
 *
 * @param item 확인할 알림 item
 * @returns 관리자 알림 item 여부
 */
function isAdminNotificationListItem(
  item: Awaited<ReturnType<typeof getAdminNotificationList>>[number],
): item is AdminNotificationListItemType {
  return item.source === "ADMIN";
}

/**
 * 읽음 처리된 관리자 알림을 관리자 Bell 캐시에서 제거합니다.
 *
 * @param current 현재 관리자 알림 응답
 * @param notificationId 제거할 관리자 알림 event ID
 * @returns 갱신된 관리자 알림 응답
 */
export function removeReadAdminNotificationFromResponse(
  current: AdminNotificationListItemType[] | undefined,
  notificationId: string,
) {
  if (!current) return current;

  const hasItem = current.some((item) => item.id === notificationId);

  if (!hasItem) return current;

  return current.filter((item) => item.id !== notificationId);
}

/**
 * 현재 관리자 알림 응답을 모두 읽은 상태로 비웁니다.
 *
 * @param current 현재 관리자 알림 응답
 * @returns 빈 관리자 알림 응답
 */
function removeAllAdminNotificationsFromResponse(
  current: AdminNotificationListItemType[] | undefined,
) {
  if (!current) return current;

  return [];
}

/**
 * 관리자 전용 알림 Bell입니다.
 *
 * 사용자 알림과 별도 query/action을 사용하며, 읽음 처리는
 * admin_notification_reads만 갱신합니다.
 */
export function AdminNotificationBell({
  adminUserId,
}: AdminNotificationBellProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);
  const previousUnreadCountRef = useRef(0);
  const adminNotificationsQueryKey =
    ADMIN_NOTIFICATIONS_QUERY_KEY.user(adminUserId);
  const markAllReadMutation = useMarkAllAdminNotificationsAsRead();
  const {
    data: unreadCounts = {},
    isFetching: isCountFetching,
    isLoading: isCountLoading,
  } = useAdminUnreadNotificationCounts();

  const {
    data: adminItems = [],
    isError,
    isFetching: isListFetching,
    isLoading: isListLoading,
    refetch,
  } = useQuery({
    enabled: open,
    queryFn: fetchAdminNotificationList,
    queryKey: adminNotificationsQueryKey,
    retry: 1,
  });

  const unreadCount = sumAdminUnreadCounts(unreadCounts);

  useEffect(() => {
    if (previousUnreadCountRef.current === unreadCount) return;

    previousUnreadCountRef.current = unreadCount;

    if (!open) return;

    void refetch();
  }, [open, refetch, unreadCount]);

  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);
  const buttonLabel =
    unreadCount > 0 ? `읽지 않은 관리자 알림 ${unreadCount}개` : "관리자 알림";
  const hasHiddenUnreadNotifications = unreadCount > adminItems.length;
  const isFetching = isCountFetching || isListFetching;

  /**
   * 관리자 알림 목록 열림 상태를 전환합니다.
   */
  const handleToggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
  };

  /**
   * 관리자 알림 대상 페이지로 이동할 때 Bell을 닫습니다.
   */
  const handleItemNavigate = () => {
    setOpen(false);
  };

  /**
   * 읽음 처리된 관리자 알림을 현재 Bell 캐시에서 제거합니다.
   *
   * @param notificationId 읽음 처리된 관리자 알림 event ID
   */
  const handleItemRead = (notificationId: string) => {
    queryClient.setQueryData<AdminNotificationListItemType[]>(
      adminNotificationsQueryKey,
      (current) =>
        removeReadAdminNotificationFromResponse(current, notificationId),
    );
  };

  /**
   * 현재 관리자의 모든 관리자 알림을 읽음 처리합니다.
   */
  const handleAllRead = async () => {
    const result = await markAllReadMutation.mutateAsync();

    if (!result.ok) return;

    queryClient.setQueryData<AdminNotificationListItemType[]>(
      adminNotificationsQueryKey,
      removeAllAdminNotificationsFromResponse,
    );
  };

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label={buttonLabel}
        aria-expanded={open}
        title="관리자 알림"
        className="relative"
        onClick={handleToggle}
      >
        {isCountLoading ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <ShieldAlert aria-hidden="true" />
        )}
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className={cn(
              "absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] font-semibold leading-4  text-white",
              unreadCount > 99 && "min-w-6",
            )}
          >
            {displayCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="fixed inset-x-4 top-19 z-50 overflow-hidden rounded-lg border bg-background shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(calc(100vw-2rem),24rem)]">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">관리자 알림</p>
              <p className="text-xs text-muted-foreground">
                읽지 않은 관리자 알림 {unreadCount}개
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isFetching ? (
                <Loader2
                  className="size-4 animate-spin text-muted-foreground"
                  aria-hidden="true"
                />
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={
                  unreadCount === 0 ||
                  isCountLoading ||
                  markAllReadMutation.isPending
                }
                onClick={handleAllRead}
              >
                전체 읽음
              </Button>
            </div>
          </div>

          <AdminNotificationList
            items={adminItems}
            isError={isError}
            isLoading={isListLoading}
            onItemNavigate={handleItemNavigate}
            onItemRead={handleItemRead}
          />

          {hasHiddenUnreadNotifications ? (
            <p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
              최근 {adminItems.length}개만 표시됩니다.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
