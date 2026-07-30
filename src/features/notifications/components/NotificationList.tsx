"use client";

import Link from "next/link";

import { NOTIFICATION_STATUS } from "@/lib/constants/notifications";
import { formatDateTime } from "@/lib/utils/formatDate";

import {
  ADMIN_NOTIFICATION_DEFINITIONS,
  USER_NOTIFICATION_DEFINITIONS,
} from "../definitions";
import type { NotificationListItemType } from "../schema";

type NotificationListProps = {
  items: NotificationListItemType[];
  isError?: boolean;
  isLoading?: boolean;
  onItemNavigate?: () => void;
};

/**
 * 알림 상태에 대한 표시 라벨을 반환합니다.
 *
 * @param status 알림 읽음 상태
 * @returns 사용자에게 보여줄 상태 라벨
 */
function getStatusLabel(status: NotificationListItemType["status"]): string {
  if (status === NOTIFICATION_STATUS.SENT) return "새 알림";
  return "읽음";
}

/**
 * 알림 출처에 대한 표시 라벨을 반환합니다.
 *
 * @param source 알림 생성 출처
 * @returns 사용자에게 보여줄 출처 라벨
 */
function getSourceLabel(source: NotificationListItemType["source"]): string {
  return source === "ADMIN" ? "관리자" : "개인";
}

/**
 * 본문이나 노트 제목이 없는 알림에 사용할 타입별 fallback 라벨을 반환합니다.
 *
 * @param item 표시할 알림 item
 * @returns 알림 설명 문구
 */
function getNotificationDescription(item: NotificationListItemType): string {
  if (item.noteTitle) return item.noteTitle;
  if (item.body) return item.body;

  if (
    Object.prototype.hasOwnProperty.call(
      ADMIN_NOTIFICATION_DEFINITIONS,
      item.type,
    )
  ) {
    const type = item.type as keyof typeof ADMIN_NOTIFICATION_DEFINITIONS;

    return ADMIN_NOTIFICATION_DEFINITIONS[type].label;
  }

  const type = item.type as keyof typeof USER_NOTIFICATION_DEFINITIONS;

  return USER_NOTIFICATION_DEFINITIONS[type].label;
}

export function NotificationList({
  items,
  isError = false,
  isLoading = false,
  onItemNavigate,
}: NotificationListProps) {
  if (isLoading) {
    return (
      <ul className="max-h-96 overflow-y-auto" aria-label="알림 목록">
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
        알림을 불러오지 못했습니다.
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border-t border-border/60 px-4 py-8 text-center text-sm text-muted-foreground">
        새 알림이 없습니다.
      </div>
    );
  }

  return (
    <ul className="max-h-96 overflow-y-auto" aria-label="알림 목록">
      {items.map((item) => {
        const description = getNotificationDescription(item);
        const content = (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {item.title}
              </span>
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-medium text-primary">
                {getSourceLabel(item.source)}
              </span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-medium text-muted-foreground">
                {getStatusLabel(item.status)}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {description}
            </p>
            <p className="mt-2 text-[0.7rem] text-muted-foreground/80">
              {formatDateTime(item.sent_at)}
            </p>
          </div>
        );

        return (
          <li
            key={item.id}
            className="flex items-start gap-2 border-t border-border/60 px-4 py-3 transition-colors hover:bg-muted/40"
          >
            <Link
              href={item.click_path}
              className="min-w-0 flex-1"
              onClick={() => {
                onItemNavigate?.();
              }}
            >
              {content}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
