import { describe, expect, it } from "vitest";

import { NOTIFICATION_STATUS } from "@/lib/constants/notifications";

import {
  notificationStatusSchema,
  notificationTimeSchema,
  pushSubscriptionSchema,
} from "../schema";

describe("notificationStatusSchema", () => {
  it.each([NOTIFICATION_STATUS.SENT, NOTIFICATION_STATUS.READ])(
    "accepts %s",
    (status) => {
      expect(notificationStatusSchema.safeParse(status).success).toBe(true);
    },
  );

  it("rejects the removed skipped status", () => {
    expect(notificationStatusSchema.safeParse("SKIPPED").success).toBe(false);
  });
});

describe("pushSubscriptionSchema", () => {
  it("accepts the browser push subscription JSON shape", () => {
    const result = pushSubscriptionSchema.safeParse({
      endpoint: "https://push.example.test/subscription-id",
      expirationTime: null,
      keys: {
        p256dh: "p256dh-key",
        auth: "auth-secret",
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects a subscription without required keys", () => {
    const result = pushSubscriptionSchema.safeParse({
      endpoint: "https://push.example.test/subscription-id",
      keys: {
        p256dh: "p256dh-key",
      },
    });

    expect(result.success).toBe(false);
  });
});

describe("notificationTimeSchema", () => {
  it.each(["00:00", "09:30", "23:59"])("accepts %s", (time) => {
    expect(notificationTimeSchema.safeParse(time).success).toBe(true);
  });

  it.each(["9:30", "24:00", "12:60", "12:30:00"])("rejects %s", (time) => {
    expect(notificationTimeSchema.safeParse(time).success).toBe(false);
  });
});
