import type { PushSubscription } from "web-push";
import * as webpush from "web-push";

const WEB_PUSH_SOCKET_TIMEOUT_MS = 10_000;

export type WebPushSendResultType =
  | {
      ok: true;
      gone?: never;
      reason?: never;
      statusCode?: never;
    }
  | {
      ok: false;
      gone?: boolean;
      reason?: unknown;
      statusCode?: number;
    };

export type WebPushPayloadType = {
  body?: string;
  data?: Record<string, unknown>;
  title: string;
};

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for Web Push dispatch.`);
  }

  return value;
}

function getVapidSubject(): string {
  // web-push 스펙상 subject는 https: 또는 mailto: 스킴만 허용. http://localhost는 거절되므로
  // dev에서는 VAPID_SUBJECT(mailto:)로 우회하고, prod는 https인 NEXT_PUBLIC_APP_URL을 그대로 사용.
  const subject =
    process.env.VAPID_SUBJECT ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL;

  if (!subject) {
    throw new Error(
      "VAPID_SUBJECT, NEXT_PUBLIC_APP_URL, or APP_URL is required for Web Push dispatch.",
    );
  }

  return subject;
}

function getWebPushStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) {
    return undefined;
  }

  return typeof error.statusCode === "number" ? error.statusCode : undefined;
}

function getWebPushFailureReason(error: unknown): unknown {
  if (typeof error === "object" && error !== null && "body" in error) {
    return error.body;
  }

  if (error instanceof Error) {
    return { message: error.message, name: error.name };
  }

  if (typeof error === "string") {
    return error;
  }

  return undefined;
}

function createFailureResult(error: unknown): WebPushSendResultType {
  const statusCode = getWebPushStatusCode(error);
  const reason = getWebPushFailureReason(error);
  const result: WebPushSendResultType =
    statusCode === 404 || statusCode === 410
      ? { gone: true, ok: false }
      : { ok: false };

  if (statusCode !== undefined) {
    result.statusCode = statusCode;
  }

  if (reason !== undefined) {
    result.reason = reason;
  }

  return result;
}

export function setVapidDetails(): void {
  webpush.setVapidDetails(
    getVapidSubject(),
    getRequiredEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY"),
    getRequiredEnv("VAPID_PRIVATE_KEY"),
  );
}

export async function sendPush(
  subscription: PushSubscription,
  payload: WebPushPayloadType,
): Promise<WebPushSendResultType> {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      timeout: WEB_PUSH_SOCKET_TIMEOUT_MS,
    });
    return { ok: true };
  } catch (error) {
    return createFailureResult(error);
  }
}
