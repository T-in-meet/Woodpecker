import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendNotificationMock, setVapidDetailsMock } = vi.hoisted(() => ({
  sendNotificationMock: vi.fn(),
  setVapidDetailsMock: vi.fn(),
}));

vi.mock("web-push", () => ({
  sendNotification: sendNotificationMock,
  setVapidDetails: setVapidDetailsMock,
}));

import { sendPush, setVapidDetails } from ".";

const SUBSCRIPTION = {
  endpoint: "https://push.example.test/subscription-id",
  keys: {
    auth: "auth-secret",
    p256dh: "p256dh-key",
  },
};

describe("web push helper", () => {
  beforeEach(() => {
    sendNotificationMock.mockReset();
    setVapidDetailsMock.mockReset();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://woodpecker.example.test");
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "private-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("configures VAPID details from env", () => {
    setVapidDetails();

    expect(setVapidDetailsMock).toHaveBeenCalledWith(
      "https://woodpecker.example.test",
      "public-key",
      "private-key",
    );
  });

  it("sends a JSON encoded payload", async () => {
    sendNotificationMock.mockResolvedValue({ statusCode: 201 });

    const result = await sendPush(SUBSCRIPTION, { title: "Review due" });

    expect(sendNotificationMock).toHaveBeenCalledWith(
      SUBSCRIPTION,
      JSON.stringify({ title: "Review due" }),
      { timeout: 10_000 },
    );
    expect(setVapidDetailsMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it("marks expired subscriptions as gone", async () => {
    sendNotificationMock.mockRejectedValue({ statusCode: 410 });

    await expect(
      sendPush(SUBSCRIPTION, { title: "Review due" }),
    ).resolves.toEqual({
      gone: true,
      ok: false,
      statusCode: 410,
    });
  });

  it("returns provider failure context for non-expired errors", async () => {
    sendNotificationMock.mockRejectedValue({
      body: "provider temporarily unavailable",
      statusCode: 503,
    });

    await expect(
      sendPush(SUBSCRIPTION, { title: "Review due" }),
    ).resolves.toEqual({
      ok: false,
      reason: "provider temporarily unavailable",
      statusCode: 503,
    });
  });

  it("throws when VAPID env is missing", () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");

    expect(() => setVapidDetails()).toThrow(
      "VAPID_PRIVATE_KEY is required for Web Push dispatch.",
    );
  });
});
