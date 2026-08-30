import { NextResponse } from "next/server";
import { z } from "zod";

import { getLegalAcceptanceRequiredPath } from "@/features/auth/lib/userAgreements";
import { NOTIFICATION_TYPES } from "@/lib/constants/notifications";
import { ROUTES } from "@/lib/constants/routes";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const markNotificationReadRequestSchema = z
  .object({
    notificationId: z.string().uuid(),
    type: z.string(),
  })
  .strict();

/**
 * Marks a non-review user notification as read for the current session user.
 *
 * REVIEW notifications are intentionally skipped because review completion is
 * the only event that consumes them.
 */
export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const parsed = markNotificationReadRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (parsed.data.type === NOTIFICATION_TYPES.REVIEW) {
    return NextResponse.json({ updated: false });
  }

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

    const { data, error } = await supabase.rpc("mark_notification_as_read", {
      p_notification_id: parsed.data.notificationId,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ updated: data ?? false });
  } catch (error) {
    logError({ event: "notifications.read.failed", error });
    return NextResponse.json(
      { error: "notification_read_failed" },
      { status: 500 },
    );
  }
}
