/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import { type PrecacheEntry, Serwist } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (PrecacheEntry | string)[];
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

function getRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

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
  const url = getNotificationUrl(event.notification.data);

  event.notification.close();
  event.waitUntil(self.clients.openWindow(url));
});
