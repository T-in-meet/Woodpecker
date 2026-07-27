"use server";

import { ADMIN_NOTIFICATION_TYPES } from "@/lib/constants/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminNotificationType } from "@/types/notifications.types";

import { requireAdmin } from "../utils/require-admin";

type AdminNotificationQueryClient = Pick<
  ReturnType<typeof createAdminClient>,
  "from"
>;

type AdminNotificationEventRow = {
  id: string;
  type: AdminNotificationType;
};

type AdminNotificationReadRow = {
  event_id: string;
};

/**
 * 관리자 알림 타입별 읽지 않은 개수입니다.
 *
 * 존재하지 않는 key는 0으로 해석합니다. 새 알림 타입이 추가되어도
 * 0 값을 채우기 위한 별도 초기화가 필요 없도록 sparse map으로 반환합니다.
 */
export type AdminUnreadNotificationCounts = Partial<
  Record<AdminNotificationType, number>
>;

export type GetAdminUnreadNotificationCountsOptions = {
  /** 테스트 또는 특수 실행 경로에서 사용할 관리자 권한 Supabase Client */
  supabase?: AdminNotificationQueryClient;

  /** 테스트 또는 이미 관리자 검증을 마친 호출 경로에서 사용할 관리자 ID */
  adminUserId?: string;
};

function incrementUnreadCount(
  counts: AdminUnreadNotificationCounts,
  type: AdminNotificationType,
) {
  counts[type] = (counts[type] ?? 0) + 1;
}

function isAdminNotificationType(
  value: string,
): value is AdminNotificationType {
  return Object.values(ADMIN_NOTIFICATION_TYPES).includes(
    value as AdminNotificationType,
  );
}

/**
 * 현재 관리자 기준으로 읽지 않은 관리자 알림 개수를 타입별로 조회합니다.
 *
 * 읽음 상태는 admin_notification_reads에 해당 event_id/admin_user_id 조합이
 * 존재하는지로 판단합니다.
 *
 * @param options 테스트 또는 이미 인증된 경로에서 주입할 조회 옵션
 * @returns 1개 이상 읽지 않은 알림이 있는 타입만 담은 count map
 */
export async function getAdminUnreadNotificationCounts(
  options: GetAdminUnreadNotificationCountsOptions = {},
): Promise<AdminUnreadNotificationCounts> {
  const adminUserId = options.adminUserId ?? (await requireAdmin());
  const supabase = options.supabase ?? createAdminClient();

  const { data: events, error: eventsError } = await supabase
    .from("admin_notification_events")
    .select("id, type");

  if (eventsError) {
    throw eventsError;
  }

  const { data: reads, error: readsError } = await supabase
    .from("admin_notification_reads")
    .select("event_id")
    .eq("admin_user_id", adminUserId);

  if (readsError) {
    throw readsError;
  }

  const readEventIds = new Set(
    ((reads ?? []) as AdminNotificationReadRow[]).map((read) => read.event_id),
  );
  const counts: AdminUnreadNotificationCounts = {};

  for (const event of (events ?? []) as AdminNotificationEventRow[]) {
    if (readEventIds.has(event.id) || !isAdminNotificationType(event.type)) {
      continue;
    }

    incrementUnreadCount(counts, event.type);
  }

  return counts;
}
