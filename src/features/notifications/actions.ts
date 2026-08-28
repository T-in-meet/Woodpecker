"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";
import { requireCurrentLegalAcceptance } from "@/features/auth/utils/requireCurrentLegalAcceptance";
import { MAX_NOTIFICATION_SCHEDULE_OFFSET_DAYS } from "@/lib/constants/notifications";
import { getNoteDetailRoute, ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import { isWithinScheduleRange, toScheduledAt } from "./lib/time";
import {
  notificationIdSchema,
  pushSubscriptionEndpointSchema,
  pushSubscriptionSchema,
  setNotificationScheduleSchema,
  setNotificationTimeSchema,
} from "./schema";

type NotificationActionResultType =
  | {
      success: true;
      error?: never;
    }
  | {
      success: false;
      error: string;
    };

export type MarkNotificationAsReadActionResultType =
  | {
      success: true;
      updated: boolean;
      error?: never;
    }
  | {
      success: false;
      updated?: never;
      error: string;
    };

export type CheckPushSubscriptionOwnedResultType = { owned: boolean };

async function getVerifiedNotificationContext(redirectPath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." } as const;
  }

  if (user.email_confirmed_at == null) {
    redirect(`${ROUTES.RESEND_EMAIL}?purpose=signup`);
  }

  await requireCurrentLegalAcceptance(user.id, redirectPath);

  return { supabase, userId: user.id } as const;
}

export async function subscribeToPushAction(
  subscription: unknown,
): Promise<NotificationActionResultType> {
  const parsed = pushSubscriptionSchema.safeParse(subscription);

  if (!parsed.success) {
    return {
      success: false,
      error: "브라우저 구독 정보가 올바르지 않습니다.",
    };
  }

  const context = await getVerifiedNotificationContext(ROUTES.MYPAGE);

  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { endpoint, keys } = parsed.data;
  const { error } = await context.supabase.from("push_subscriptions").upsert(
    {
      user_id: context.userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return {
      success: false,
      error:
        "푸시 알림 구독에 실패했습니다. 브라우저 알림 구독을 해제한 뒤 다시 시도해주세요.",
    };
  }

  revalidatePath(ROUTES.MYPAGE);

  return { success: true };
}

export async function unsubscribeFromPushAction(
  endpoint: unknown,
): Promise<NotificationActionResultType> {
  const parsed = pushSubscriptionEndpointSchema.safeParse(endpoint);

  if (!parsed.success) {
    return {
      success: false,
      error: "브라우저 구독 정보가 올바르지 않습니다.",
    };
  }

  const context = await getVerifiedNotificationContext(ROUTES.MYPAGE);

  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { error } = await context.supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data)
    .eq("user_id", context.userId);

  if (error) {
    return {
      success: false,
      error: "푸시 알림 구독 해제에 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  revalidatePath(ROUTES.MYPAGE);

  return { success: true };
}

export async function checkPushSubscriptionOwnedAction(
  endpoint: unknown,
): Promise<CheckPushSubscriptionOwnedResultType> {
  const parsed = pushSubscriptionEndpointSchema.safeParse(endpoint);

  if (!parsed.success) {
    return { owned: false };
  }

  const context = await getVerifiedNotificationContext(ROUTES.MYPAGE);

  if ("error" in context) {
    return { owned: false };
  }

  const { count, error } = await context.supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("endpoint", parsed.data)
    .eq("user_id", context.userId);

  if (error) {
    return { owned: false };
  }

  return { owned: (count ?? 0) > 0 };
}

export async function markNotificationAsReadAction(
  notificationId: unknown,
  redirectPath: unknown,
): Promise<MarkNotificationAsReadActionResultType> {
  const parsed = notificationIdSchema.safeParse(notificationId);

  if (!parsed.success) {
    return { success: false, error: "알림을 찾을 수 없습니다." };
  }

  const context = await getVerifiedNotificationContext(
    validateRedirectPath(redirectPath),
  );

  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { data, error } = await context.supabase.rpc(
    "mark_notification_as_read",
    {
      p_notification_id: parsed.data,
    },
  );

  if (error) {
    return {
      success: false,
      error: "알림 읽음 처리에 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  // Bell state refresh is handled by the client React Query cache.
  return { success: true, updated: data ?? false };
}

/**
 * 달력에서 고른 날짜·시각으로 이번 복습 회차의 알림 일정을 옮긴다.
 * 날짜를 되돌리는 경로는 `setNotificationTimeAction(noteId, null)`이다 —
 * RPC가 보존해둔 원래 케이던스 시각을 그대로 복원한다.
 */
export async function setNotificationScheduleAction(
  noteId: unknown,
  date: unknown,
  time: unknown,
): Promise<NotificationActionResultType> {
  const parsed = setNotificationScheduleSchema.safeParse({
    noteId,
    date,
    time,
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    if (fieldErrors.noteId) {
      return { success: false, error: "알림 대상을 찾을 수 없습니다." };
    }

    return { success: false, error: "알림 일정이 올바르지 않습니다." };
  }

  const {
    noteId: parsedNoteId,
    date: parsedDate,
    time: parsedTime,
  } = parsed.data;
  const scheduledAt = toScheduledAt(parsedDate, parsedTime);

  if (scheduledAt === null) {
    return { success: false, error: "알림 일정이 올바르지 않습니다." };
  }

  // 날짜 선택 UI가 막아두는 범위지만, 액션은 직접 호출될 수 있으므로 다시 본다.
  // 최종 판정은 KST "지금"을 아는 RPC가 한다.
  if (!isWithinScheduleRange(parsedDate)) {
    return {
      success: false,
      error: `오늘부터 ${MAX_NOTIFICATION_SCHEDULE_OFFSET_DAYS}일 이내로만 옮길 수 있습니다.`,
    };
  }

  const context = await getVerifiedNotificationContext(
    getNoteDetailRoute(parsedNoteId),
  );

  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { error } = await context.supabase.rpc("update_notification_schedule", {
    p_note_id: parsedNoteId,
    p_scheduled_at: scheduledAt,
  });

  if (error) {
    if (error.message.includes("no pending review log")) {
      return {
        success: false,
        error: "이미 발송된 알림은 일정을 바꿀 수 없습니다.",
      };
    }

    if (error.message.includes("schedule out of range")) {
      return {
        success: false,
        error: `오늘부터 ${MAX_NOTIFICATION_SCHEDULE_OFFSET_DAYS}일 이내로만 옮길 수 있습니다.`,
      };
    }

    if (error.message.includes("schedule in the past")) {
      return {
        success: false,
        error: "이미 지난 시각으로는 옮길 수 없습니다.",
      };
    }

    return {
      success: false,
      error: "알림 일정 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  revalidatePath(getNoteDetailRoute(parsedNoteId));

  return { success: true };
}

export async function setNotificationTimeAction(
  noteId: unknown,
  time: unknown,
): Promise<NotificationActionResultType> {
  const parsed = setNotificationTimeSchema.safeParse({
    noteId,
    time: time === "" ? null : time,
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    if (fieldErrors.noteId) {
      return { success: false, error: "알림 대상을 찾을 수 없습니다." };
    }

    return { success: false, error: "알림 시간이 올바르지 않습니다." };
  }

  const context = await getVerifiedNotificationContext(
    getNoteDetailRoute(parsed.data.noteId),
  );

  if ("error" in context) {
    return { success: false, error: context.error };
  }

  const { noteId: parsedNoteId, time: parsedTime } = parsed.data;
  const rpcArgs =
    parsedTime === null
      ? { p_note_id: parsedNoteId }
      : { p_note_id: parsedNoteId, p_time: parsedTime };
  const { error } = await context.supabase.rpc(
    "update_notification_time_of_day",
    rpcArgs,
  );

  if (error) {
    return {
      success: false,
      error: "알림 시간 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
    };
  }

  revalidatePath(getNoteDetailRoute(parsedNoteId));

  return { success: true };
}
