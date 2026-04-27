import type { PushSubscription } from "web-push";
import * as webpush from "web-push";

export type WebPushSendResultType =
  | {
      ok: true;
      gone?: never;
    }
  | {
      ok: false;
      gone?: boolean;
    };

export type WebPushPayloadType = Record<string, unknown>;

function getRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required for Web Push dispatch.`);
  }

  return value;
}

function getVapidSubject(): string {
  const subject = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL;

  if (!subject) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL or APP_URL is required for Web Push dispatch.",
    );
  }

  return subject;
}

function hasGoneStatus(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) {
    return false;
  }

  return error.statusCode === 404 || error.statusCode === 410;
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
  setVapidDetails();

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (error) {
    if (hasGoneStatus(error)) {
      return { gone: true, ok: false };
    }

    return { ok: false };
  }
}
