import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPES,
} from "@/lib/constants/notifications";
import { createServerComponentClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

import {
  notificationListItemSchema,
  type NotificationListItemType,
} from "./schema";

const DEFAULT_NOTIFICATION_LIST_LIMIT = 20;
const MAX_NOTIFICATION_LIST_LIMIT = 50;

const joinedNoteSchema = z.object({
  title: z.string(),
});

const notificationListRowSchema = notificationListItemSchema
  .omit({ noteTitle: true })
  .extend({
    note: joinedNoteSchema.nullable().optional(),
  });

const notificationListRowToItemSchema = notificationListRowSchema.transform(
  ({ note, ...item }) => ({
    ...item,
    noteTitle: note?.title ?? null,
  }),
);

export type { NotificationListItemType };

type NotificationQueryClientType = {
  auth: Pick<SupabaseClient<Database>["auth"], "getUser">;
  from: SupabaseClient<Database>["from"];
};

type NotificationQueryOptionsType = {
  supabase?: NotificationQueryClientType;
  userId?: string;
};

type NotificationListOptionsType = NotificationQueryOptionsType & {
  limit?: number;
};

function normalizeNotificationListLimit(limit: number | undefined) {
  if (typeof limit !== "number" || !Number.isInteger(limit)) {
    return DEFAULT_NOTIFICATION_LIST_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_NOTIFICATION_LIST_LIMIT);
}

/**
 * Defaults to the RSC client; route handlers and server actions should inject
 * their strict client and userId after their own auth check.
 */
async function getNotificationQueryContext(
  options: NotificationQueryOptionsType = {},
) {
  const supabase = options.supabase ?? (await createServerComponentClient());

  if (options.userId) {
    return {
      supabase,
      userId: options.userId,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    userId: user?.id ?? null,
  };
}

export async function getUnreadCount(
  options: NotificationQueryOptionsType = {},
): Promise<number> {
  const { supabase, userId } = await getNotificationQueryContext(options);

  if (!userId) return 0;

  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", NOTIFICATION_TYPES.REVIEW)
    .eq("status", NOTIFICATION_STATUS.SENT);

  if (error) throw error;

  return count ?? 0;
}

export async function getNotificationList(
  options: NotificationListOptionsType = {},
): Promise<NotificationListItemType[]> {
  const { supabase, userId } = await getNotificationQueryContext(options);

  if (!userId) return [];

  const limit = normalizeNotificationListLimit(options.limit);
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "id, title, body, type, status, sent_at, read_at, note_id, review_log_id, note:notes(title)",
    )
    .eq("user_id", userId)
    .eq("type", NOTIFICATION_TYPES.REVIEW)
    .in("status", [
      NOTIFICATION_STATUS.SENT,
      NOTIFICATION_STATUS.READ,
      NOTIFICATION_STATUS.SKIPPED,
    ])
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  const parsed = z.array(notificationListRowToItemSchema).safeParse(data);

  if (!parsed.success) {
    throw parsed.error;
  }

  return parsed.data;
}

export async function getHasAnyPushSubscription(
  options: NotificationQueryOptionsType = {},
): Promise<boolean> {
  const { supabase, userId } = await getNotificationQueryContext(options);

  if (!userId) return false;

  const { count, error } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;

  return (count ?? 0) > 0;
}
