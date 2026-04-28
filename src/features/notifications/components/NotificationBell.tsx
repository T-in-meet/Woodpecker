"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { NOTIFICATION_STATUS } from "@/lib/constants/notifications";
import { cn } from "@/lib/utils/cn";

import { markNotificationAsReadAction } from "../actions";
import {
  notificationsResponseSchema,
  type NotificationsResponseType,
} from "../schema";
import { NotificationList } from "./NotificationList";

const EMPTY_NOTIFICATIONS: NotificationsResponseType = {
  items: [],
  unreadCount: 0,
};

class UnauthorizedNotificationError extends Error {}

async function fetchNotifications(): Promise<NotificationsResponseType> {
  const response = await fetch("/api/notifications", {
    credentials: "same-origin",
  });

  if (response.status === 401) {
    throw new UnauthorizedNotificationError("로그인이 필요합니다.");
  }

  if (!response.ok) {
    throw new Error("알림을 불러오지 못했습니다.");
  }

  const payload: unknown = await response.json();
  const parsed = notificationsResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("알림 응답이 올바르지 않습니다.");
  }

  return parsed.data;
}

function markAsReadInCache(
  data: NotificationsResponseType,
  notificationId: string,
  updated: boolean,
): NotificationsResponseType {
  if (!updated) return data;

  const target = data.items.find((item) => item.id === notificationId);
  const shouldReduceUnread = target?.status === NOTIFICATION_STATUS.SENT;

  return {
    unreadCount: shouldReduceUnread
      ? Math.max(data.unreadCount - 1, 0)
      : data.unreadCount,
    items: data.items.map((item) =>
      item.id === notificationId
        ? {
            ...item,
            status: NOTIFICATION_STATUS.READ,
            read_at: item.read_at ?? new Date().toISOString(),
          }
        : item,
    ),
  };
}

type NotificationBellProps = {
  userId: string;
};

export function NotificationBell({ userId }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [markingNotificationId, setMarkingNotificationId] = useState<
    string | null
  >(null);
  const queryClient = useQueryClient();
  const ref = useRef<HTMLDivElement>(null);
  const notificationsQueryKey = ["notifications", userId] as const;

  const {
    data = EMPTY_NOTIFICATIONS,
    isError,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: fetchNotifications,
    refetchInterval: 60_000,
    retry: (failureCount, error) =>
      !(error instanceof UnauthorizedNotificationError) && failureCount < 1,
    staleTime: 30_000,
  });

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

  const unreadCount = data.unreadCount;
  const displayCount = unreadCount > 99 ? "99+" : String(unreadCount);
  const buttonLabel =
    unreadCount > 0 ? `읽지 않은 알림 ${unreadCount}개` : "알림";

  const handleToggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);

    if (nextOpen) {
      setActionError(null);
      void refetch();
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    if (markingNotificationId === notificationId) return;

    setActionError(null);
    setMarkingNotificationId(notificationId);

    try {
      const result = await markNotificationAsReadAction(notificationId);

      if (!result.success) {
        setActionError(result.error);
        return;
      }

      queryClient.setQueryData<NotificationsResponseType>(
        notificationsQueryKey,
        (current) =>
          current
            ? markAsReadInCache(current, notificationId, result.updated)
            : current,
      );
    } catch {
      setActionError("알림 읽음 처리에 실패했습니다.");
    } finally {
      setMarkingNotificationId(null);
    }
  };

  const handleItemNavigate = () => {
    setOpen(false);
  };

  const hasHiddenUnreadNotifications = unreadCount > data.items.length;

  return (
    <div ref={ref} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        aria-label={buttonLabel}
        aria-expanded={open}
        className="relative"
        onClick={handleToggle}
      >
        {isLoading ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Bell aria-hidden="true" />
        )}
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className={cn(
              "absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] font-semibold leading-4 text-primary-foreground",
              unreadCount > 99 && "min-w-6",
            )}
          >
            {displayCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(calc(100vw-2rem),24rem)] overflow-hidden rounded-lg border bg-background shadow-lg">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">알림</p>
              <p className="text-xs text-muted-foreground">
                읽지 않은 알림 {unreadCount}개
              </p>
            </div>
            {isFetching && (
              <Loader2
                className="size-4 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
            )}
          </div>

          {actionError && (
            <p
              role="alert"
              className="border-t border-border/60 px-4 py-2 text-sm text-destructive"
            >
              {actionError}
            </p>
          )}

          <NotificationList
            items={data.items}
            isError={isError}
            isLoading={isLoading}
            markingNotificationId={markingNotificationId}
            onItemNavigate={handleItemNavigate}
            onMarkAsRead={handleMarkAsRead}
          />

          {hasHiddenUnreadNotifications && (
            <p className="border-t border-border/60 px-4 py-2 text-xs text-muted-foreground">
              최근 {data.items.length}개만 표시됩니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
