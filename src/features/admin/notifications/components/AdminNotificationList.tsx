"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

import type { NotificationListItemType } from "@/features/notifications/schema";
import { NOTIFICATION_STATUS } from "@/lib/constants/notifications";
import { formatDateTime } from "@/lib/utils/formatDate";
import type { AdminNotificationType } from "@/types/notifications.types";

import { useMarkAdminNotificationsAsRead } from "../hooks/use-mark-admin-notifications-as-read";

export type AdminNotificationListItemType = NotificationListItemType & {
  source: "ADMIN";
  type: AdminNotificationType;
};

type AdminNotificationListProps = {
  isError?: boolean;
  isLoading?: boolean;
  items: AdminNotificationListItemType[];
  onItemNavigate?: () => void;
  onItemRead?: (notificationId: string) => void;
};

/**
 * 관리자 알림 상태에 대한 표시 라벨을 반환합니다.
 *
 * @param status 알림 읽음 상태
 * @returns 관리자에게 보여줄 상태 라벨
 */
function getAdminNotificationStatusLabel(
  status: NotificationListItemType["status"],
): string {
  if (status === NOTIFICATION_STATUS.SENT) return "새 알림";
  return "읽음";
}

/**
 * 관리자 알림 클릭이 새 탭, 새 창, 보조 클릭인지 확인합니다.
 *
 * @param event 링크 클릭 이벤트
 * @returns 기본 라우팅을 유지해야 하는 수정 클릭 여부
 */
function isModifiedClick(event: MouseEvent<HTMLAnchorElement>) {
  return (
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey ||
    event.button !== 0
  );
}

/**
 * 관리자 알림 목록을 표시하고 클릭한 관리자 알림만 관리자 read row로 저장합니다.
 */
export function AdminNotificationList({
  isError = false,
  isLoading = false,
  items,
  onItemNavigate,
  onItemRead,
}: AdminNotificationListProps) {
  const router = useRouter();
  const markReadMutation = useMarkAdminNotificationsAsRead();

  if (isLoading) {
    return (
      <ul className="max-h-96 overflow-y-auto" aria-label="관리자 알림 목록">
        {Array.from({ length: 3 }, (_, index) => (
          <li key={index} className="border-t border-border/60 px-4 py-3">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-44 animate-pulse rounded bg-muted" />
          </li>
        ))}
      </ul>
    );
  }

  if (isError) {
    return (
      <div className="border-t border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
        관리자 알림을 불러오지 못했습니다.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border-t border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
        새 관리자 알림이 없습니다.
      </div>
    );
  }

  return (
    <ul className="max-h-96 overflow-y-auto" aria-label="관리자 알림 목록">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-start gap-2 border-t border-border/60 px-4 py-3 transition-colors hover:bg-muted/40"
        >
          <Link
            href={item.click_path}
            className="min-w-0 flex-1"
            onClick={async (event) => {
              if (isModifiedClick(event)) {
                onItemNavigate?.();
                return;
              }

              event.preventDefault();

              try {
                const result = await markReadMutation.mutateAsync({
                  clickPath: item.click_path,
                  type: item.type,
                });

                if (result.ok && result.updated > 0) {
                  onItemRead?.(item.id);
                }
              } catch {
                // 읽음 처리는 부가 작업이므로 실패해도 관리자 대상 이동은 유지한다.
              }

              onItemNavigate?.();
              router.push(item.click_path);
            }}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">
                  {item.title}
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                  {getAdminNotificationStatusLabel(item.status)}
                </span>
              </div>
              {item.body ? (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {item.body}
                </p>
              ) : null}
              <p className="mt-2 text-[0.7rem] text-muted-foreground/80">
                {formatDateTime(item.sent_at)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
