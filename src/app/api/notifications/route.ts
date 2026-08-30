import { NextResponse } from "next/server";

import { getLegalAcceptanceRequiredPath } from "@/features/auth/lib/userAgreements";
import {
  getNotificationList,
  getUnreadCount,
} from "@/features/notifications/queries";
import { ROUTES } from "@/lib/constants/routes";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NOTIFICATION_LIST_LIMIT = 20;

/**
 * Returns unread user notifications for the current session user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const agreementRequiredPath = await getLegalAcceptanceRequiredPath(
      user.id,
      ROUTES.MYPAGE,
    );
    if (agreementRequiredPath) {
      return NextResponse.json(
        {
          error: "legal_acceptance_required",
          redirectTo: agreementRequiredPath,
        },
        { status: 403 },
      );
    }

    const [items, unreadCount] = await Promise.all([
      getNotificationList({
        limit: NOTIFICATION_LIST_LIMIT,
        supabase,
        userId: user.id,
      }),
      getUnreadCount({ supabase, userId: user.id }),
    ]);

    return NextResponse.json({
      items,
      unreadCount,
    });
  } catch (error) {
    logError({ event: "notifications.get.failed", error });
    return NextResponse.json(
      { error: "notifications_lookup_failed" },
      { status: 500 },
    );
  }
}
