import { NextResponse } from "next/server";
import { z } from "zod";

import { getLegalAcceptanceRequiredPath } from "@/features/auth/lib/userAgreements";
import { ROUTES } from "@/lib/constants/routes";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const markNotificationReadRequestSchema = z
  .object({
    notificationId: z.string().uuid(),
    // 읽음 처리 자체는 타입을 가리지 않는다. 서비스 워커가 보내는 값이라
    // `.strict()`가 거부하지 않도록 스키마에는 남겨 둔다.
    type: z.string(),
  })
  .strict();

/**
 * Marks a user notification as read for the current session user.
 *
 * REVIEW notifications are included: opening a notification consumes it, and
 * review completion marks it read through a separate path.
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
