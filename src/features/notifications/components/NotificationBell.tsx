"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

import {
  notificationsResponseSchema,
  type NotificationsResponseType,
} from "../schema";
import { NotificationList } from "./NotificationList";

const EMPTY_NOTIFICATIONS: NotificationsResponseType = {
  items: [],
  unreadCount: 0,
};
const ROUTE_CHANGE_REFETCH_COOLDOWN_MS = 30_000;

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

type NotificationBellProps = {
  userId: string;
};

export function NotificationBell({ userId }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const previousPathnameRef = useRef(pathname);
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
    if (previousPathnameRef.current === pathname) return;

    previousPathnameRef.current = pathname;
    const notificationsQueryState = queryClient.getQueryState([
      "notifications",
      userId,
    ] as const);
    const lastFetchedAt = notificationsQueryState?.dataUpdatedAt ?? 0;

    if (
      notificationsQueryState?.fetchStatus === "fetching" ||
      Date.now() - lastFetchedAt < ROUTE_CHANGE_REFETCH_COOLDOWN_MS
    ) {
      return;
    }

    void refetch();
  }, [pathname, queryClient, refetch, userId]);

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
      void refetch();
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
        <div className="fixed inset-x-4 top-19 z-50 overflow-hidden rounded-lg border bg-background shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[min(calc(100vw-2rem),24rem)]">
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

          <NotificationList
            items={data.items}
            isError={isError}
            isLoading={isLoading}
            onItemNavigate={handleItemNavigate}
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
