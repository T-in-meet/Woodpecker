import { describe, expect, it, vi } from "vitest";

vi.mock("./authRateLimitConstants", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("./authRateLimitConstants")>();

  const nonResendMaxWindowMs = Math.max(
    actual.AUTH_GLOBAL_REQUEST_IP_LONG_WINDOW_MS,
    actual.LOGIN_EMAIL_ATTEMPT_WINDOW_MS,
    actual.LOGIN_IP_LONG_WINDOW_MS,
    actual.OTP_ISSUE_EMAIL_ATTEMPT_WINDOW_MS,
    actual.OTP_ISSUE_EMAIL_SUCCESS_WINDOW_MS,
    actual.OTP_ISSUE_IP_LONG_WINDOW_MS,
    actual.OTP_VERIFY_IP_LONG_WINDOW_MS,
  );

  return {
    ...actual,
    SIGNUP_RESEND_REQUEST_IP_LONG_WINDOW_MS: nonResendMaxWindowMs * 2,
  };
});

import {
  AUTH_GLOBAL_REQUEST_IP_LONG_WINDOW_MS,
  LOGIN_EMAIL_ATTEMPT_WINDOW_MS,
  LOGIN_IP_LONG_WINDOW_MS,
  OTP_ISSUE_EMAIL_ATTEMPT_WINDOW_MS,
  OTP_ISSUE_EMAIL_SUCCESS_WINDOW_MS,
  OTP_ISSUE_IP_LONG_WINDOW_MS,
  OTP_VERIFY_IP_LONG_WINDOW_MS,
  SIGNUP_RESEND_REQUEST_IP_LONG_WINDOW_MS,
} from "./authRateLimitConstants";
import { createInMemoryAuthRateLimitStore } from "./inMemoryAuthRateLimitStore";

const NON_RESEND_MAX_WINDOW_MS = Math.max(
  AUTH_GLOBAL_REQUEST_IP_LONG_WINDOW_MS,
  LOGIN_EMAIL_ATTEMPT_WINDOW_MS,
  LOGIN_IP_LONG_WINDOW_MS,
  OTP_ISSUE_EMAIL_ATTEMPT_WINDOW_MS,
  OTP_ISSUE_EMAIL_SUCCESS_WINDOW_MS,
  OTP_ISSUE_IP_LONG_WINDOW_MS,
  OTP_VERIFY_IP_LONG_WINDOW_MS,
);

describe("createInMemoryAuthRateLimitStore timestamp retention", () => {
  it("Signup Resend long window가 더 길어져도 유효 timestamp를 먼저 cleanup하지 않는다", () => {
    const store = createInMemoryAuthRateLimitStore();
    const key = "signup-resend-retention";
    const t0 = 1_000_000;

    store.runAtomic(() => {
      store.setTimestampWindow(key, [t0]);
    }, t0);

    const t1 = t0 + NON_RESEND_MAX_WINDOW_MS + 1;

    store.runAtomic(() => undefined, t1);

    expect(store.getTimestampWindow(key)).toEqual([t0]);

    const t2 = t0 + SIGNUP_RESEND_REQUEST_IP_LONG_WINDOW_MS + 1;

    store.runAtomic(() => undefined, t2);

    expect(store.getTimestampWindow(key)).toBeUndefined();
  });
});
