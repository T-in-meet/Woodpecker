import { describe, expect, it } from "vitest";

import { buildFeedbackReplyNotificationDefinition } from "../definitions";

describe("notification definitions", () => {
  it("uses the support inquiry page for feedback reply notification clicks", () => {
    const definition = buildFeedbackReplyNotificationDefinition({
      feedbackId: "11111111-1111-4111-8111-111111111111",
    });

    expect(definition.clickPath).toBe("/mypage?section=support&tab=inquiry");
  });
});
