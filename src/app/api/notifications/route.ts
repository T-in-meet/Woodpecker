import { NextResponse } from "next/server";

import {
  getAdminNotificationList,
  getAdminUnreadNotificationCounts,
} from "@/features/admin/notifications/queries";
import {
  getNotificationList,
  getUnreadCount,
  type NotificationListItemType,
} from "@/features/notifications/queries";
import { logError } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NOTIFICATION_LIST_LIMIT = 20;

async function getIsAdmin(userId: string) {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.role === "ADMIN";
}

function sumAdminUnreadCounts(
  counts: Awaited<ReturnType<typeof getAdminUnreadNotificationCounts>>,
) {
  return Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0);
}

function mergeNotificationLists(
  items: NotificationListItemType[],
  adminItems: NotificationListItemType[],
) {
  return [...items, ...adminItems]
    .sort(
      (left, right) =>
        new Date(right.sent_at).getTime() - new Date(left.sent_at).getTime(),
    )
    .slice(0, NOTIFICATION_LIST_LIMIT);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const isAdmin = await getIsAdmin(user.id);
    const [items, unreadCount, adminItems, adminUnreadCounts] =
      await Promise.all([
        getNotificationList({
          limit: NOTIFICATION_LIST_LIMIT,
          supabase,
          userId: user.id,
        }),
        getUnreadCount({ supabase, userId: user.id }),
        isAdmin
          ? getAdminNotificationList({
              adminUserId: user.id,
              limit: NOTIFICATION_LIST_LIMIT,
            })
          : Promise.resolve([]),
        isAdmin
          ? getAdminUnreadNotificationCounts({ adminUserId: user.id })
          : Promise.resolve({}),
      ]);

    return NextResponse.json({
      items: mergeNotificationLists(items, adminItems),
      unreadCount: unreadCount + sumAdminUnreadCounts(adminUnreadCounts),
    });
  } catch (error) {
    logError({ event: "notifications.get.failed", error });
    return NextResponse.json(
      { error: "notifications_lookup_failed" },
      { status: 500 },
    );
  }
}
