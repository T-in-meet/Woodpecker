import { describe, expect, it } from "vitest";

import { notificationTimeSchema, pushSubscriptionSchema } from "../schema";

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
