import { expect, vi } from "vitest";

import {
  type ForgotPasswordActionState,
  INITIAL_FORGOT_PASSWORD_ACTION_STATE,
} from "../../forgotPasswordAction";

const hoisted = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  checkRequestEligibility: vi.fn(),
  getClientIp: vi.fn(),
  canonicalizeEmail: vi.fn(),
  applyMinimumActionDelay: vi.fn(),
  logRequested: vi.fn(),
  logAuthEvent: vi.fn(),
  logAuthError: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: hoisted.createClientMock,
}));

vi.mock("@/features/auth/lib/checkRequestEligibility", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/auth/lib/checkRequestEligibility")
  >("@/features/auth/lib/checkRequestEligibility");
  return {
    ...actual,
    checkRequestEligibility: hoisted.checkRequestEligibility,
  };
});

vi.mock("@/lib/utils/getClientIp", () => ({
  getClientIp: hoisted.getClientIp,
}));

vi.mock("@/features/auth/utils/canonicalizeEmail", () => ({
  canonicalizeEmail: hoisted.canonicalizeEmail,
}));

vi.mock("@/features/auth/lib/applyMinimumActionDelay", () => ({
  applyMinimumActionDelay: hoisted.applyMinimumActionDelay,
}));

vi.mock("@/features/auth/lib/authLogger", () => ({
  logRequested: hoisted.logRequested,
  logAuthEvent: hoisted.logAuthEvent,
  logAuthError: hoisted.logAuthError,
  normalizeUnknownError: vi.fn((error: unknown) =>
    error instanceof Error
      ? { errorMessage: error.message, errorName: error.name }
      : { errorMessage: String(error), errorName: "UnknownError" },
  ),
}));

export type RateLimitMode = "allow" | "block";
export type SupabaseMode = "success" | "error" | "emailNotFoundError" | "throw";

export type ForgotPasswordActionTestOptions = {
  email?: string;
  redirect?: string | null;
  ip?: string;
  appUrl?: string;
  rateLimit?: {
    ipShort?: RateLimitMode;
    ipLong?: RateLimitMode;
    emailShort?: RateLimitMode;
    emailLong?: RateLimitMode;
  };
  supabase?: SupabaseMode;
};

export function makeFormData(input: { email: string }) {
  const formData = new FormData();
  formData.set("email", input.email);
  return formData;
}

function resolveBlockedBy(
  rateLimit?: ForgotPasswordActionTestOptions["rateLimit"],
) {
  if (rateLimit?.ipShort === "block") return "ipShort";
  if (rateLimit?.ipLong === "block") return "ipLong";
  if (rateLimit?.emailShort === "block") return "emailShort";
  if (rateLimit?.emailLong === "block") return "emailLong";
  return null;
}

function mockSupabase(mode: SupabaseMode) {
  if (mode === "success") {
    hoisted.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    return;
  }
  if (mode === "error") {
    hoisted.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: new Error("supabase error"),
    });
    return;
  }
  if (mode === "emailNotFoundError") {
    hoisted.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: new Error("email not found"),
    });
    return;
  }
  hoisted.resetPasswordForEmail.mockRejectedValue(
    new Error("unexpected error"),
  );
}

export function setupActionTest(options: ForgotPasswordActionTestOptions = {}) {
  vi.clearAllMocks();

  process.env["APP_URL"] = options.appUrl ?? "https://example.com";

  hoisted.createClientMock.mockResolvedValue({
    auth: {
      resetPasswordForEmail: hoisted.resetPasswordForEmail,
    },
  } as never);

  const email = options.email ?? "user@example.com";
  hoisted.getClientIp.mockReturnValue(options.ip ?? "203.0.113.10");
  hoisted.canonicalizeEmail.mockImplementation((input: string) =>
    input.trim().toLowerCase(),
  );
  hoisted.applyMinimumActionDelay.mockResolvedValue(undefined);

  const blockedBy = resolveBlockedBy(options.rateLimit);
  hoisted.checkRequestEligibility.mockReturnValue(
    blockedBy ? { allowed: false, blockedBy } : { allowed: true },
  );

  mockSupabase(options.supabase ?? "success");

  async function callAction(override?: {
    email?: string;
    redirect?: string | null;
  }) {
    const mod = await import("../../forgotPasswordAction");
    return mod.forgotPasswordAction(
      override?.redirect ?? options.redirect ?? null,
      INITIAL_FORGOT_PASSWORD_ACTION_STATE,
      makeFormData({ email: override?.email ?? email }),
    );
  }

  return {
    callAction,
    resetPasswordForEmailMock: hoisted.resetPasswordForEmail,
    applyMinimumActionDelayMock: hoisted.applyMinimumActionDelay,
    logRequestedMock: hoisted.logRequested,
    logAuthEventMock: hoisted.logAuthEvent,
    logAuthErrorMock: hoisted.logAuthError,
    checkRequestEligibilityMock: hoisted.checkRequestEligibility,
    getClientIpMock: hoisted.getClientIp,
    canonicalizeEmailMock: hoisted.canonicalizeEmail,
  };
}

export function expectActionStateShape(state: unknown) {
  const typed = state as ForgotPasswordActionState;
  expect(typed).toHaveProperty("status");
  expect(typed).toHaveProperty("fieldErrors");
  expect(typed).toHaveProperty("message");
  expect(typed).not.toHaveProperty("code");
  expect(typed).not.toHaveProperty("success");
  expect(typed).not.toHaveProperty("data");
}

export function getTerminalEventCallCount(mocks: {
  logAuthEventMock: { mock: { calls: unknown[][] } };
  logAuthErrorMock: { mock: { calls: unknown[][] } };
}) {
  return (
    mocks.logAuthEventMock.mock.calls.length +
    mocks.logAuthErrorMock.mock.calls.length
  );
}
