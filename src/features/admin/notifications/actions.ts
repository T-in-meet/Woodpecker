"use server";

import { z } from "zod";

import { ADMIN_NOTIFICATION_TYPES } from "@/lib/constants/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../utils/require-admin";

const markAdminNotificationsAsReadInputSchema = z.object({
  clickPath: z.string().trim().min(1),
  type: z.enum([
    ADMIN_NOTIFICATION_TYPES.FEEDBACK_CREATED,
    ADMIN_NOTIFICATION_TYPES.OPERATIONAL_ERROR,
  ]),
});

/** 관리자 알림 읽음 처리 대상을 식별하는 입력 값입니다. */
export type MarkAdminNotificationsAsReadInput = z.infer<
  typeof markAdminNotificationsAsReadInputSchema
>;

/** 관리자 알림 읽음 처리 Server Action의 실행 결과입니다. */
export type MarkAdminNotificationsAsReadResult =
  | {
      ok: true;
      updated: number;
    }
  | {
      message: string;
      ok: false;
    };

type AdminNotificationReadSupabaseClient = ReturnType<typeof createAdminClient>;

type AdminNotificationReadRow = {
  admin_user_id: string;
  event_id: string;
};

/**
 * 관리자 알림 event id 목록을 현재 관리자 기준 읽음 row로 저장합니다.
 *
 * @param supabase 관리자 권한 Supabase client
 * @param adminUserId 읽음 처리할 관리자 사용자 ID
 * @param eventIds 읽음 처리할 관리자 알림 event ID 목록
 * @returns 읽음 row 저장 성공 여부
 */
async function upsertAdminNotificationReads(
  supabase: AdminNotificationReadSupabaseClient,
  adminUserId: string,
  eventIds: string[],
): Promise<{ error: unknown | null }> {
  if (eventIds.length === 0) {
    return { error: null };
  }

  const rows: AdminNotificationReadRow[] = eventIds.map((eventId) => ({
    admin_user_id: adminUserId,
    event_id: eventId,
  }));

  const { error } = await supabase
    .from("admin_notification_reads")
    .upsert(rows, { onConflict: "event_id,admin_user_id" });

  return { error };
}

/**
 * 현재 관리자 기준으로 특정 관리자 알림 이벤트들을 읽음 처리합니다.
 *
 * 관리자 알림은 공용 event row와 관리자별 read row를 분리해서 저장하므로,
 * type과 click_path로 대상 event를 찾은 뒤 admin_notification_reads에 upsert합니다.
 *
 * @param input 읽음 처리할 관리자 알림 type과 clickPath
 * @returns 읽음 처리 결과와 대상 event 수
 */
export async function markAdminNotificationsAsReadAction(
  input: MarkAdminNotificationsAsReadInput,
): Promise<MarkAdminNotificationsAsReadResult> {
  const parsed = markAdminNotificationsAsReadInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      message: "관리자 알림 대상이 올바르지 않습니다.",
      ok: false,
    };
  }

  const adminUserId = await requireAdmin();
  const supabase = createAdminClient();
  const { clickPath, type } = parsed.data;

  const { data: events, error: eventsError } = await supabase
    .from("admin_notification_events")
    .select("id")
    .eq("type", type)
    .eq("click_path", clickPath);

  if (eventsError) {
    return {
      message: "관리자 알림 조회에 실패했습니다.",
      ok: false,
    };
  }

  if (!events || events.length === 0) {
    return { ok: true, updated: 0 };
  }

  const { error: readsError } = await upsertAdminNotificationReads(
    supabase,
    adminUserId,
    events.map((event) => event.id),
  );

  if (readsError) {
    return {
      message: "관리자 알림 읽음 처리에 실패했습니다.",
      ok: false,
    };
  }

  return { ok: true, updated: events.length };
}

/**
 * 현재 관리자에게 표시될 수 있는 모든 관리자 알림을 읽음 처리합니다.
 *
 * 관리자 알림은 사용자 notifications 테이블과 독립적이므로 이 액션은
 * admin_notification_reads 테이블만 갱신합니다.
 *
 * @returns 읽음 처리 결과와 대상 event 수
 */
export async function markAllAdminNotificationsAsReadAction(): Promise<MarkAdminNotificationsAsReadResult> {
  const adminUserId = await requireAdmin();
  const supabase = createAdminClient();
  const { data: events, error: eventsError } = await supabase
    .from("admin_notification_events")
    .select("id");

  if (eventsError) {
    return {
      message: "관리자 알림 조회에 실패했습니다.",
      ok: false,
    };
  }

  if (!events || events.length === 0) {
    return { ok: true, updated: 0 };
  }

  const { error: readsError } = await upsertAdminNotificationReads(
    supabase,
    adminUserId,
    events.map((event) => event.id),
  );

  if (readsError) {
    return {
      message: "관리자 알림 읽음 처리에 실패했습니다.",
      ok: false,
    };
  }

  return { ok: true, updated: events.length };
}
