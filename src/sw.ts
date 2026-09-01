/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import { type PrecacheEntry, Serwist } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[];
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // First push rollout should receive review reminders without waiting for every open tab to close.
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

const NOTIFICATION_READ_API_PATH = "/api/notifications/read";

/**
 * Returns an object record when the push data shape can be inspected.
 */
function getRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Normalizes a web push payload into Notification API fields.
 */
function getPushPayload(data: PushMessageData | null) {
  if (!data) {
    return {
      title: "Review reminder",
      notificationData: { url: "/" },
    };
  }

  let record: Record<string, unknown> | null = null;

  try {
    record = getRecord(data.json());
  } catch {
    record = null;
  }

  const nestedData = getRecord(record?.data);
  const notificationData = nestedData ?? record ?? { url: "/" };
  const title =
    typeof record?.title === "string" ? record.title : "Review reminder";
  const body = typeof record?.body === "string" ? record.body : undefined;
  const tag =
    typeof notificationData.reviewLogId === "string"
      ? notificationData.reviewLogId
      : undefined;

  return { body, notificationData, tag, title };
}

/**
 * Resolves a safe same-origin URL from notification click data.
 */
function getNotificationUrl(data: unknown) {
  const record = getRecord(data);
  const url = typeof record?.url === "string" ? record.url : "/";

  try {
    const targetUrl = new URL(url, self.location.origin);
    return targetUrl.origin === self.location.origin
      ? targetUrl.href
      : self.location.origin;
  } catch {
    return self.location.origin;
  }
}

/**
 * Checks whether a client is a same-origin browser window.
 */
function isSameOriginWindowClient(client: Client): client is WindowClient {
  return (
    client.type === "window" &&
    new URL(client.url).origin === self.location.origin
  );
}

/**
 * Focuses an existing same-origin tab or opens a new one for the notification.
 */
async function openOrFocusNotificationUrl(url: string) {
  const windowClients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  const sameOriginClient = windowClients.find(isSameOriginWindowClient);

  if (sameOriginClient) {
    const navigatedClient =
      sameOriginClient.url === url
        ? sameOriginClient
        : await sameOriginClient.navigate(url);

    await (navigatedClient ?? sameOriginClient).focus();
    return;
  }

  await self.clients.openWindow(url);
}

/**
 * Marks a clicked notification as read without blocking navigation.
 *
 * 복습 알림도 포함한다. 알림을 여는 것이 곧 확인이고, 복습 완료로 읽음 처리되는
 * 경로는 별도로 남아 있다.
 */
async function markNotificationReadOnClick(data: unknown) {
  const record = getRecord(data);
  const notificationId = record?.notificationId;
  const type = record?.type;

  if (typeof notificationId !== "string" || typeof type !== "string") {
    return;
  }

  try {
    await fetch(NOTIFICATION_READ_API_PATH, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ notificationId, type }),
    });
  } catch {
    // 읽음 처리는 부가 작업이므로 실패해도 알림 대상 이동은 유지한다.
  }
}

self.addEventListener("push", (event) => {
  const { body, notificationData, tag, title } = getPushPayload(event.data);
  const options: NotificationOptions = {
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    data: notificationData,
  };

  if (body) options.body = body;
  if (tag) options.tag = tag;

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  const notificationData = event.notification.data;
  const url = getNotificationUrl(event.notification.data);

  event.notification.close();
  event.waitUntil(
    Promise.all([
      markNotificationReadOnClick(notificationData),
      openOrFocusNotificationUrl(url),
    ]).then(() => undefined),
  );
});
