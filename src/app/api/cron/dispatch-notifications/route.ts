import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import {
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPES,
} from "@/lib/constants/notifications";
import { logError, logWarn } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPush, setVapidDetails } from "@/lib/webPush";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CLAIM_LIMIT = 200;
const CLAIM_CONCURRENCY = 8;
const REVIEW_NOTIFICATION_TITLE = "복습할 시간이에요!";
const REVIEW_ROUTE_SEGMENT = "review";

type ClaimedReviewLogType = {
  id: string;
  note_id: string;
  round: number;
  scheduled_at: string;
  user_id: string;
};

type PushSubscriptionRowType = {
  auth: string;
  endpoint: string;
  id: string;
  p256dh: string;
};

type DispatchStatsType = {
  claimed: number;
  dispatched: number;
  expiredSubscriptions: number;
  itemFailed: number;
  pushFailed: number;
  pushed: number;
};

type DispatchItemStatsType = Omit<DispatchStatsType, "claimed">;

type PushDispatchStatsType = Pick<
  DispatchItemStatsType,
  "expiredSubscriptions" | "pushFailed" | "pushed"
>;

type EnsureNotificationResultType = {
  id: string;
};

function hashSecretValue(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

function timingSafeStringEqual(left: string, right: string): boolean {
  return timingSafeEqual(hashSecretValue(left), hashSecretValue(right));
}

function getSecretErrorResponse(): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logError({ event: "cron.dispatchNotifications.secretMissing" });
    return NextResponse.json({ error: "cron_secret_missing" }, { status: 500 });
  }

  return null;
}

function authorizeCronRequest(request: Request): NextResponse | null {
  const secretError = getSecretErrorResponse();

  if (secretError) {
    return secretError;
  }

  const expectedAuthorization = `Bearer ${process.env.CRON_SECRET}`;
  const authorization = request.headers.get("authorization") ?? "";

  if (!timingSafeStringEqual(authorization, expectedAuthorization)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return null;
}

function buildReviewUrl(noteId: string): string {
  return `/notes/${noteId}/${REVIEW_ROUTE_SEGMENT}`;
}

function buildReviewNotificationBody(noteTitle: string): string {
  return `"${noteTitle}" 복습할 시간이에요.`;
}

function buildPushPayload({
  noteId,
  noteTitle,
  notificationId,
  reviewLogId,
}: {
  noteId: string;
  noteTitle: string;
  notificationId: string;
  reviewLogId: string;
}) {
  const url = buildReviewUrl(noteId);

  return {
    title: REVIEW_NOTIFICATION_TITLE,
    body: buildReviewNotificationBody(noteTitle),
    data: {
      noteId,
      notificationId,
      reviewLogId,
      url,
    },
  };
}

async function deleteExpiredSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: PushSubscriptionRowType,
): Promise<boolean> {
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("id", subscription.id);

  if (error) {
    logWarn({
      event: "cron.dispatchNotifications.subscriptionDeleteFailed",
      error,
      subscriptionId: subscription.id,
    });
    return false;
  }

  return true;
}

async function ensureNotification(
  supabase: ReturnType<typeof createAdminClient>,
  claimedLog: ClaimedReviewLogType,
  noteTitle: string,
): Promise<EnsureNotificationResultType> {
  const { data, error } = await supabase
    .from("notifications")
    .upsert(
      {
        body: noteTitle,
        note_id: claimedLog.note_id,
        review_log_id: claimedLog.id,
        status: NOTIFICATION_STATUS.SENT,
        title: REVIEW_NOTIFICATION_TITLE,
        type: NOTIFICATION_TYPES.REVIEW,
        user_id: claimedLog.user_id,
      },
      { ignoreDuplicates: true, onConflict: "review_log_id,type" },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (data?.id) {
    return { id: data.id };
  }

  const { data: existingNotification, error: existingNotificationError } =
    await supabase
      .from("notifications")
      .select("id")
      .eq("review_log_id", claimedLog.id)
      .eq("type", NOTIFICATION_TYPES.REVIEW)
      .eq("user_id", claimedLog.user_id)
      .maybeSingle();

  if (existingNotificationError) {
    throw existingNotificationError;
  }

  if (!existingNotification?.id) {
    throw new Error(
      "Existing notification was not found after upsert conflict.",
    );
  }

  return { id: existingNotification.id };
}

async function markReviewLogDispatched(
  supabase: ReturnType<typeof createAdminClient>,
  reviewLogId: string,
): Promise<void> {
  const { error } = await supabase
    .from("review_logs")
    .update({ notification_dispatched_at: new Date().toISOString() })
    .eq("id", reviewLogId);

  if (error) {
    throw error;
  }
}

async function dispatchPushSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: PushSubscriptionRowType,
  payload: ReturnType<typeof buildPushPayload>,
): Promise<PushDispatchStatsType> {
  const stats = {
    expiredSubscriptions: 0,
    pushFailed: 0,
    pushed: 0,
  };

  const result = await sendPush(
    {
      endpoint: subscription.endpoint,
      keys: {
        auth: subscription.auth,
        p256dh: subscription.p256dh,
      },
    },
    payload,
  );

  if (result.ok) {
    stats.pushed += 1;
    return stats;
  }

  if (result.gone) {
    const deleted = await deleteExpiredSubscription(supabase, subscription);

    if (deleted) {
      stats.expiredSubscriptions += 1;
    } else {
      stats.pushFailed += 1;
    }

    return stats;
  }

  stats.pushFailed += 1;
  logWarn({
    event: "cron.dispatchNotifications.pushFailed",
    ...(result.reason !== undefined ? { reason: result.reason } : {}),
    reviewLogId: payload.data.reviewLogId,
    ...(result.statusCode !== undefined
      ? { statusCode: result.statusCode }
      : {}),
    subscriptionId: subscription.id,
  });

  return stats;
}

function addPushDispatchStats(
  current: PushDispatchStatsType,
  next: PushDispatchStatsType,
): void {
  current.expiredSubscriptions += next.expiredSubscriptions;
  current.pushFailed += next.pushFailed;
  current.pushed += next.pushed;
}

async function dispatchClaimedReviewLog(
  supabase: ReturnType<typeof createAdminClient>,
  claimedLog: ClaimedReviewLogType,
): Promise<DispatchItemStatsType> {
  const stats = {
    dispatched: 0,
    expiredSubscriptions: 0,
    itemFailed: 0,
    pushFailed: 0,
    pushed: 0,
  };

  try {
    const [noteResult, subscriptionsResult] = await Promise.all([
      supabase
        .from("notes")
        .select("title")
        .eq("id", claimedLog.note_id)
        .eq("user_id", claimedLog.user_id)
        .maybeSingle(),
      supabase
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", claimedLog.user_id),
    ]);

    if (noteResult.error) {
      throw noteResult.error;
    }

    if (subscriptionsResult.error) {
      throw subscriptionsResult.error;
    }

    if (!noteResult.data) {
      stats.itemFailed += 1;
      logWarn({
        event: "cron.dispatchNotifications.noteMissing",
        noteId: claimedLog.note_id,
        reviewLogId: claimedLog.id,
        userId: claimedLog.user_id,
      });
      return stats;
    }

    const noteTitle = noteResult.data.title;
    const notification = await ensureNotification(
      supabase,
      claimedLog,
      noteTitle,
    );

    const payload = buildPushPayload({
      noteId: claimedLog.note_id,
      noteTitle,
      notificationId: notification.id,
      reviewLogId: claimedLog.id,
    });

    const subscriptions = subscriptionsResult.data ?? [];
    const pushStats = {
      expiredSubscriptions: 0,
      pushFailed: 0,
      pushed: 0,
    };
    const pushResults = await Promise.allSettled(
      subscriptions.map((subscription) =>
        dispatchPushSubscription(supabase, subscription, payload),
      ),
    );

    for (const [index, pushResult] of pushResults.entries()) {
      if (pushResult.status === "fulfilled") {
        addPushDispatchStats(pushStats, pushResult.value);
        continue;
      }

      pushStats.pushFailed += 1;
      logWarn({
        event: "cron.dispatchNotifications.pushFailed",
        error: pushResult.reason,
        reviewLogId: claimedLog.id,
        subscriptionId: subscriptions[index]?.id,
      });
    }

    addPushDispatchStats(stats, pushStats);

    if (pushStats.pushFailed > 0) {
      // Keep the review log retryable because web push has no per-subscription delivery state.
      return stats;
    }

    await markReviewLogDispatched(supabase, claimedLog.id);
    stats.dispatched += 1;
  } catch (error) {
    stats.itemFailed += 1;
    logError({
      event: "cron.dispatchNotifications.itemFailed",
      error,
      reviewLogId: claimedLog.id,
    });
  }

  return stats;
}

function addDispatchStats(
  current: DispatchStatsType,
  next: DispatchItemStatsType,
): void {
  current.dispatched += next.dispatched;
  current.expiredSubscriptions += next.expiredSubscriptions;
  current.itemFailed += next.itemFailed;
  current.pushFailed += next.pushFailed;
  current.pushed += next.pushed;
}

async function runWithConcurrencyLimit<ItemType, ResultType>(
  items: readonly ItemType[],
  concurrency: number,
  task: (item: ItemType) => Promise<ResultType>,
): Promise<ResultType[]> {
  const results = new Array<ResultType>(items.length);
  const iterator = items.entries();
  const workerCount = Math.min(Math.max(concurrency, 1), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      for (let next = iterator.next(); !next.done; next = iterator.next()) {
        const [index, item] = next.value;
        results[index] = await task(item);
      }
    }),
  );

  return results;
}

export async function GET(request: Request) {
  const unauthorizedResponse = authorizeCronRequest(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    setVapidDetails();

    const supabase = createAdminClient();
    const { data: claimedLogRows, error } = await supabase.rpc(
      "claim_due_review_logs",
      { p_limit: CLAIM_LIMIT },
    );

    if (error) {
      logError({ event: "cron.dispatchNotifications.claimFailed", error });
      return NextResponse.json(
        { error: "notification_claim_failed" },
        { status: 500 },
      );
    }

    const claimedLogs = claimedLogRows ?? [];

    const stats: DispatchStatsType = {
      claimed: claimedLogs.length,
      dispatched: 0,
      expiredSubscriptions: 0,
      itemFailed: 0,
      pushFailed: 0,
      pushed: 0,
    };

    const claimedLogResults = await runWithConcurrencyLimit(
      claimedLogs,
      CLAIM_CONCURRENCY,
      (claimedLog) => dispatchClaimedReviewLog(supabase, claimedLog),
    );

    for (const nextStats of claimedLogResults) {
      addDispatchStats(stats, nextStats);
    }

    return NextResponse.json(stats);
  } catch (error) {
    logError({ event: "cron.dispatchNotifications.failed", error });
    return NextResponse.json(
      { error: "notification_dispatch_failed" },
      { status: 500 },
    );
  }
}
