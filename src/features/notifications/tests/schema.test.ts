import { describe, expect, it } from "vitest";

import { NOTIFICATION_STATUS } from "@/lib/constants/notifications";

import {
  notificationListItemSchema,
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

describe("notificationListItemSchema", () => {
  const baseNotification = {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Review due",
    body: null,
    click_path: "/notes/22222222-2222-4222-8222-222222222222/review",
    type: "REVIEW",
    status: NOTIFICATION_STATUS.SENT,
    source: "USER",
    sent_at: "2026-04-27T01:00:00.000Z",
    read_at: null,
    note_id: "22222222-2222-4222-8222-222222222222",
    review_log_id: null,
    noteTitle: "Interval note",
  };

  it("accepts review notification list items", () => {
    expect(notificationListItemSchema.safeParse(baseNotification).success).toBe(
      true,
    );
  });

  it("accepts feedback reply notification list items without a note id", () => {
    expect(
      notificationListItemSchema.safeParse({
        ...baseNotification,
        click_path: "/mypage?feedbackId=33333333-3333-4333-8333-333333333333",
        note_id: null,
        noteTitle: null,
        type: "FEEDBACK_REPLY",
      }).success,
    ).toBe(true);
  });

  it("accepts admin notification list items", () => {
    expect(
      notificationListItemSchema.safeParse({
        ...baseNotification,
        click_path:
          "/admin/operational-errors/33333333-3333-4333-8333-333333333333",
        note_id: null,
        noteTitle: null,
        review_log_id: null,
        source: "ADMIN",
        type: "OPERATIONAL_ERROR",
      }).success,
    ).toBe(true);
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
