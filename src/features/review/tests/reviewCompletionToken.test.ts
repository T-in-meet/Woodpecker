import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createReviewCompletionToken,
  REVIEW_COMPLETION_TOKEN_TTL_SECONDS,
  verifyReviewCompletionToken,
} from "../lib/reviewCompletionToken";

const REVIEW_TOKEN_PAYLOAD = {
  noteId: "11111111-1111-4111-8111-111111111111",
  reviewLogId: "22222222-2222-4222-8222-222222222222",
  userId: "user-123",
};

describe("reviewCompletionToken", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    process.env["REVIEW_COMPLETION_TOKEN_SECRET"] = "test-review-secret";
    delete process.env["EMAIL_TICKET_SECRET"];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("verifies a freshly issued token", () => {
    const token = createReviewCompletionToken(REVIEW_TOKEN_PAYLOAD);

    expect(verifyReviewCompletionToken(token, REVIEW_TOKEN_PAYLOAD)).toBe(true);
  });

  it("rejects an expired token", () => {
    const token = createReviewCompletionToken(REVIEW_TOKEN_PAYLOAD);

    vi.advanceTimersByTime((REVIEW_COMPLETION_TOKEN_TTL_SECONDS + 1) * 1000);

    expect(verifyReviewCompletionToken(token, REVIEW_TOKEN_PAYLOAD)).toBe(
      false,
    );
  });

  it("does not fall back to the email ticket secret", () => {
    delete process.env["REVIEW_COMPLETION_TOKEN_SECRET"];
    process.env["EMAIL_TICKET_SECRET"] = "legacy-ticket-secret";

    expect(() => createReviewCompletionToken(REVIEW_TOKEN_PAYLOAD)).toThrow(
      "Review completion token secret is not configured.",
    );
  });
});
