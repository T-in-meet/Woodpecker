import "server-only";

import { z } from "zod";

import type { NotificationListItemType } from "@/features/notifications/schema";
import {
  ADMIN_NOTIFICATION_TYPES,
  NOTIFICATION_STATUS,
} from "@/lib/constants/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminNotificationType } from "@/types/notifications.types";

type AdminNotificationQueryClient = Pick<
  ReturnType<typeof createAdminClient>,
  "rpc"
>;

const adminUnreadNotificationCountRowSchema = z.object({
  type: z.enum([
    ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED,
    ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
  ]),
  unread_count: z.number().int().positive(),
});

const adminNotificationListEventRowSchema = z.object({
  body: z.string().nullable().optional(),
  click_path: z.string().min(1),
  created_at: z.string(),
  id: z.string().uuid(),
  title: z.string(),
  type: z.enum([
    ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED,
    ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
  ]),
});

type AdminNotificationListEventRow = z.infer<
  typeof adminNotificationListEventRowSchema
>;

/**
 * 관리자 알림 타입별 읽지 않은 개수입니다.
 *
 * 존재하지 않는 key는 0으로 해석합니다. 새 알림 타입이 추가되어도
 * 0 값을 채우기 위한 별도 초기화가 필요 없도록 sparse map으로 반환합니다.
 */
export type AdminUnreadNotificationCounts = Partial<
  Record<AdminNotificationType, number>
>;

export type GetAdminUnreadNotificationCountsForOptions = {
  /** 테스트 또는 서버 내부 실행 경로에서 사용할 관리자 권한 Supabase Client */
  supabase?: AdminNotificationQueryClient;
};

export type GetAdminNotificationListForOptions =
  GetAdminUnreadNotificationCountsForOptions & {
    /** 반환할 최대 알림 개수 */
    limit?: number;
  };

/**
 * 관리자 알림 count map에 특정 타입의 값을 누적합니다.
 *
 * @param counts 누적할 count map
 * @param type 관리자 알림 타입
 * @param value 더할 읽지 않은 개수
 */
function incrementUnreadCount(
  counts: AdminUnreadNotificationCounts,
  type: AdminNotificationType,
  value: number,
): void {
  counts[type] = (counts[type] ?? 0) + value;
}

/**
 * 관리자 알림 이벤트 row를 관리자 Bell에서 사용하는 알림 item으로 변환합니다.
 *
 * @param event 관리자 알림 RPC에서 반환한 이벤트 row
 * @returns 알림 목록 컴포넌트가 사용하는 item
 */
function adminEventToNotificationListItem(
  event: AdminNotificationListEventRow,
): NotificationListItemType {
  return {
    body: event.body ?? null,
    click_path: event.click_path,
    id: event.id,
    note_id: null,
    noteTitle: null,
    read_at: null,
    review_log_id: null,
    sent_at: event.created_at,
    source: "ADMIN",
    status: NOTIFICATION_STATUS.SENT,
    title: event.title,
    type: event.type,
  };
}

/**
 * 이미 관리자 인증을 마친 호출 경로에서 관리자 알림 개수를 조회합니다.
 *
 * 이 함수는 Server Action이 아니므로 호출자가 반드시 관리자 인증을 먼저
 * 완료해야 합니다. 클라이언트에 노출되는 함수에서는 사용하지 않습니다.
 *
 * @param adminUserId 인증이 끝난 관리자 사용자 ID
 * @param options Supabase client 주입 옵션
 * @returns 1개 이상 읽지 않은 알림이 있는 타입만 담은 count map
 */
export async function getAdminUnreadNotificationCountsFor(
  adminUserId: string,
  options: GetAdminUnreadNotificationCountsForOptions = {},
): Promise<AdminUnreadNotificationCounts> {
  const supabase = options.supabase ?? createAdminClient();

  const { data, error } = await supabase.rpc(
    "get_admin_unread_notification_counts",
    {
      p_admin_user_id: adminUserId,
    },
  );

  if (error) {
    throw error;
  }

  const counts: AdminUnreadNotificationCounts = {};
  const parsed = z
    .array(adminUnreadNotificationCountRowSchema)
    .safeParse(data ?? []);

  if (!parsed.success) {
    throw parsed.error;
  }

  for (const row of parsed.data) {
    incrementUnreadCount(counts, row.type, row.unread_count);
  }

  return counts;
}

/**
 * 이미 관리자 인증을 마친 호출 경로에서 읽지 않은 관리자 알림 목록을 조회합니다.
 *
 * @param adminUserId 인증이 끝난 관리자 사용자 ID
 * @param options Supabase client와 limit 주입 옵션
 * @returns 읽지 않은 관리자 알림 목록
 */
export async function getAdminNotificationListFor(
  adminUserId: string,
  options: GetAdminNotificationListForOptions = {},
): Promise<NotificationListItemType[]> {
  const supabase = options.supabase ?? createAdminClient();
  const limit = Math.max(Math.min(options.limit ?? 20, 50), 1);

  const { data, error } = await supabase.rpc(
    "get_admin_unread_notification_list",
    {
      p_admin_user_id: adminUserId,
      p_limit: limit,
    },
  );

  if (error) {
    throw error;
  }

  const parsed = z
    .array(adminNotificationListEventRowSchema)
    .safeParse(data ?? []);

  if (!parsed.success) {
    throw parsed.error;
  }

  return parsed.data.map(adminEventToNotificationListItem);
}
