"use client";

import Link from "next/link";

import { NOTIFICATION_STATUS } from "@/lib/constants/notifications";
import { getNoteReviewRoute } from "@/lib/constants/routes";
import { formatDateTime } from "@/lib/utils/formatDate";

import type { NotificationListItemType } from "../schema";

type NotificationListProps = {
  items: NotificationListItemType[];
  isError?: boolean;
  isLoading?: boolean;
  onItemNavigate?: () => void;
};

function getStatusLabel(status: NotificationListItemType["status"]) {
  if (status === NOTIFICATION_STATUS.SENT) return "새 알림";
  if (status === NOTIFICATION_STATUS.SKIPPED) return "건너뜀";
  return "읽음";
}

function getNotificationDescription(item: NotificationListItemType) {
  return item.noteTitle ?? item.body ?? "복습 알림";
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
        const reviewHref = item.note_id
          ? getNoteReviewRoute(item.note_id)
          : null;
        const content = (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-foreground">
                {item.title}
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
            {reviewHref ? (
              <Link
                href={reviewHref}
                className="min-w-0 flex-1"
                onClick={() => {
                  onItemNavigate?.();
                }}
              >
                {content}
              </Link>
            ) : (
              <div className="min-w-0 flex-1">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
