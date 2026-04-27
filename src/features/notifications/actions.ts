"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getNoteDetailRoute, ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import {
  notificationIdSchema,
  pushSubscriptionEndpointSchema,
  pushSubscriptionSchema,
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

async function getVerifiedNotificationContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다." } as const;
  }

  if (user.email_confirmed_at == null) {
    redirect(ROUTES.VERIFY_EMAIL);
  }

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

  const context = await getVerifiedNotificationContext();

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

  const context = await getVerifiedNotificationContext();

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

export async function markNotificationAsReadAction(
  notificationId: unknown,
): Promise<MarkNotificationAsReadActionResultType> {
  const parsed = notificationIdSchema.safeParse(notificationId);

  if (!parsed.success) {
    return { success: false, error: "알림을 찾을 수 없습니다." };
  }

  const context = await getVerifiedNotificationContext();

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

  const context = await getVerifiedNotificationContext();

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
