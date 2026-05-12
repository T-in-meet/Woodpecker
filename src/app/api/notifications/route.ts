import { NextResponse } from "next/server";

import {
  getNotificationList,
  getUnreadCount,
} from "@/features/notifications/queries";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const [items, unreadCount] = await Promise.all([
      getNotificationList({ supabase, userId: user.id }),
      getUnreadCount({ supabase, userId: user.id }),
    ]);

    return NextResponse.json({ items, unreadCount });
  } catch (error) {
    logError({ event: "notifications.get.failed", error });
    return NextResponse.json(
      { error: "notifications_lookup_failed" },
      { status: 500 },
    );
  }
}
