import { OPERATIONAL_ERROR_SEVERITY } from "@/features/operational-errors/constants";
import { reportOperationalError } from "@/features/operational-errors/report";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendPush,
  setVapidDetails,
  type WebPushPayloadType,
} from "@/lib/webPush";

type DispatchPushResult = {
  expiredSubscriptions: number;
  failed: number;
  sent: number;
};

type DispatchPushOptions = {
  actorUserId?: string | null;
  operation: string;
  userId: string;
};

type PushSubscriptionRow = {
  auth: string;
  endpoint: string;
  id: string;
  p256dh: string;
};

function withActorUserId(actorUserId: string | null | undefined) {
  return actorUserId === undefined ? {} : { actorUserId };
}

function serializePushFailureReason(reason: unknown) {
  if (reason === undefined || reason === null) return null;
  if (typeof reason === "string") return reason;
  if (typeof reason === "number" || typeof reason === "boolean") {
    return reason;
  }

  if (typeof reason === "object") {
    return JSON.stringify(reason);
  }

  return String(reason);
}

/**
 * Push provider가 404/410을 반환한 구독은 더 이상 사용할 수 없으므로 삭제합니다.
 * 삭제 실패는 원래 알림 흐름을 막지 않고 운영 오류로만 기록합니다.
 */
async function deleteExpiredSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: PushSubscriptionRow,
  options: DispatchPushOptions,
) {
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("id", subscription.id);

  if (!error) return true;

  await reportOperationalError({
    ...withActorUserId(options.actorUserId),
    context: {
      pushSubscriptionId: subscription.id,
      userId: options.userId,
    },
    error,
    errorCode: "PUSH_SUBSCRIPTION_DELETE_FAILED",
    feature: "notifications",
    message: "만료된 Push 구독 삭제에 실패했습니다.",
    operation: options.operation,
    severity: OPERATIONAL_ERROR_SEVERITY.WARN,
    stage: "push_subscription_cleanup",
    userId: options.userId,
  });

  return false;
}

async function dispatchPushSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: PushSubscriptionRow,
  payload: WebPushPayloadType,
  options: DispatchPushOptions,
): Promise<DispatchPushResult> {
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
    return { expiredSubscriptions: 0, failed: 0, sent: 1 };
  }

  if (result.gone) {
    const deleted = await deleteExpiredSubscription(
      supabase,
      subscription,
      options,
    );

    await reportOperationalError({
      ...withActorUserId(options.actorUserId),
      context: {
        pushSubscriptionId: subscription.id,
        statusCode: result.statusCode ?? null,
        userId: options.userId,
      },
      errorCode: "PUSH_SUBSCRIPTION_GONE",
      feature: "notifications",
      message: "만료된 Push 구독이 확인되었습니다.",
      operation: options.operation,
      severity: OPERATIONAL_ERROR_SEVERITY.INFO,
      stage: "push_subscription_cleanup",
      userId: options.userId,
    });

    return {
      expiredSubscriptions: deleted ? 1 : 0,
      failed: deleted ? 0 : 1,
      sent: 0,
    };
  }

  await reportOperationalError({
    ...withActorUserId(options.actorUserId),
    context: {
      pushSubscriptionId: subscription.id,
      reason: serializePushFailureReason(result.reason),
      statusCode: result.statusCode ?? null,
      userId: options.userId,
    },
    errorCode: "PUSH_SEND_FAILED",
    feature: "notifications",
    message: "Push 알림 전송에 실패했습니다.",
    operation: options.operation,
    severity: OPERATIONAL_ERROR_SEVERITY.WARN,
    stage: "push_send",
    userId: options.userId,
  });

  return { expiredSubscriptions: 0, failed: 1, sent: 0 };
}

function addDispatchPushResult(
  current: DispatchPushResult,
  next: DispatchPushResult,
) {
  current.expiredSubscriptions += next.expiredSubscriptions;
  current.failed += next.failed;
  current.sent += next.sent;
}

export async function dispatchPushToUser(
  payload: WebPushPayloadType,
  options: DispatchPushOptions,
): Promise<DispatchPushResult> {
  const supabase = createAdminClient();
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", options.userId);

  if (error) {
    await reportOperationalError({
      ...withActorUserId(options.actorUserId),
      context: { userId: options.userId },
      error,
      errorCode: "PUSH_SUBSCRIPTIONS_LOOKUP_FAILED",
      feature: "notifications",
      message: "Push 구독 조회에 실패했습니다.",
      operation: options.operation,
      severity: OPERATIONAL_ERROR_SEVERITY.WARN,
      stage: "push_subscription_lookup",
      userId: options.userId,
    });

    return { expiredSubscriptions: 0, failed: 1, sent: 0 };
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { expiredSubscriptions: 0, failed: 0, sent: 0 };
  }

  try {
    setVapidDetails();
  } catch (error) {
    await reportOperationalError({
      ...withActorUserId(options.actorUserId),
      context: { userId: options.userId },
      error,
      errorCode: "PUSH_VAPID_CONFIG_FAILED",
      feature: "notifications",
      message: "Push VAPID 설정에 실패했습니다.",
      operation: options.operation,
      severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
      stage: "push_vapid_setup",
      userId: options.userId,
    });

    return {
      expiredSubscriptions: 0,
      failed: subscriptions.length,
      sent: 0,
    };
  }

  const stats: DispatchPushResult = {
    expiredSubscriptions: 0,
    failed: 0,
    sent: 0,
  };
  // 한 사용자가 여러 브라우저에서 구독할 수 있으므로 endpoint별로 전송합니다.
  const results = await Promise.all(
    subscriptions.map((subscription) =>
      dispatchPushSubscription(supabase, subscription, payload, options),
    ),
  );

  for (const result of results) {
    addDispatchPushResult(stats, result);
  }

  return stats;
}
