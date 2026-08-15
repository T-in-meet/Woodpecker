"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

import {
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPES,
  type NotificationKindType,
} from "@/lib/constants/notifications";
import { formatDateTime } from "@/lib/utils/formatDate";

import { markNotificationAsReadAction } from "../actions";
import { USER_NOTIFICATION_DEFINITIONS } from "../definitions";
import type { NotificationListItemType } from "../schema";

export type UserNotificationListItemType = NotificationListItemType & {
  source: "USER";
  type: NotificationKindType;
};

type NotificationListProps = {
  items: UserNotificationListItemType[];
  isError?: boolean;
  isLoading?: boolean;
  onItemRead?: (notificationId: string) => void;
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
 * 본문이나 노트 제목이 없는 알림에 사용할 타입별 fallback 라벨을 반환합니다.
 *
 * @param item 표시할 알림 item
 * @returns 알림 설명 문구
 */
function getNotificationDescription(
  item: UserNotificationListItemType,
): string {
  if (item.noteTitle) return item.noteTitle;
  if (item.body) return item.body;

  return USER_NOTIFICATION_DEFINITIONS[item.type].label;
}

/**
 * 사용자 알림 클릭 시 즉시 읽음 처리할 대상인지 확인합니다.
 *
 * @param item 클릭한 사용자 알림 item
 * @returns 클릭 시 읽음 처리해야 하면 true
 */
function shouldMarkAsReadOnClick(item: UserNotificationListItemType) {
  // REVIEW는 복습 완료 RPC에서 READ 처리한다. 그 외 알림은 클릭을 소비로 본다.
  return (
    item.status === NOTIFICATION_STATUS.SENT &&
    item.type !== NOTIFICATION_TYPES.REVIEW
  );
}

/**
 * 사용자 알림 링크 클릭이 새 탭, 새 창, 보조 클릭인지 확인합니다.
 *
 * @param event 링크 클릭 이벤트
 * @returns 기본 링크 동작을 유지해야 하는 수정 클릭 여부
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

export function NotificationList({
  items,
  isError = false,
  isLoading = false,
  onItemRead,
  onItemNavigate,
}: NotificationListProps) {
  const router = useRouter();

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
              onClick={async (event) => {
                if (!shouldMarkAsReadOnClick(item) || isModifiedClick(event)) {
                  onItemNavigate?.();
                  return;
                }

                event.preventDefault();

                try {
                  const result = await markNotificationAsReadAction(item.id);

                  if (result.success && result.updated) {
                    onItemRead?.(item.id);
                  }
                } catch {
                  // 읽음 처리는 부가 작업이므로 실패해도 알림 대상 이동은 유지한다.
                }

                onItemNavigate?.();
                router.push(item.click_path);
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
