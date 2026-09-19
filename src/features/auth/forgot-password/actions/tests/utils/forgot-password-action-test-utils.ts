import { afterEach, beforeEach, expect, vi } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";

import {
  ForgotPasswordActionState,
  INITIAL_FORGOT_PASSWORD_ACTION_STATE,
} from "../../forgotPasswordActionState";

export const FORGOT_PASSWORD_TERMINAL_EVENTS = [
  AUTH_EVENTS.AUTH_FORGOT_PASSWORD_COMPLETED,
  AUTH_EVENTS.AUTH_FORGOT_PASSWORD_INVALID_INPUT,
  AUTH_EVENTS.AUTH_FORGOT_PASSWORD_RATE_LIMITED,
  AUTH_EVENTS.AUTH_FORGOT_PASSWORD_FAILED,
] as const;

type TerminalEvent = (typeof FORGOT_PASSWORD_TERMINAL_EVENTS)[number];

export function getTerminalEventCalls(
  mocks: ReturnType<typeof setupActionTest>,
) {
  return [
    ...mocks.logAuthEventMock.mock.calls,
    ...mocks.logAuthErrorMock.mock.calls,
  ].filter(([event]) =>
    FORGOT_PASSWORD_TERMINAL_EVENTS.includes(event as TerminalEvent),
  );
}

export function expectExactlyOneTerminalEvent(
  mocks: ReturnType<typeof setupActionTest>,
  expected: TerminalEvent,
) {
  const calls = getTerminalEventCalls(mocks);

  expect(calls).toHaveLength(1);
  expect(calls[0]?.[0]).toBe(expected);
}

export function expectRequestedBeforeTerminalEvent(
  mocks: ReturnType<typeof setupActionTest>,
) {
  const requestedOrder = mocks.logRequestedMock.mock.invocationCallOrder[0];

  const terminalOrders = [
    ...mocks.logAuthEventMock.mock.invocationCallOrder,
    ...mocks.logAuthErrorMock.mock.invocationCallOrder,
  ];

  expect(requestedOrder).toBeDefined();
  expect(terminalOrders.length).toBeGreaterThan(0);
  expect(Math.min(...terminalOrders)).toBeGreaterThan(requestedOrder!);
}

export function expectNoLegacyActionFields(state: Record<string, unknown>) {
  expect(state).not.toHaveProperty("code");
  expect(state).not.toHaveProperty("success");
  expect(state).not.toHaveProperty("data");
}

const hoisted = vi.hoisted(() => ({
  issueOtpAndSendEmailWithResult: vi.fn(),
  createOtpIssueClient: vi.fn(),
  tryConsumeGlobal: vi.fn(),
  tryStartIssue: vi.fn(),
  recordSuccessfulIssue: vi.fn(),
  releaseIssue: vi.fn(),
  redirect: vi.fn(),
  getTrustedAuthServerActionClientIp: vi.fn(),
  applyMinimumActionDelay: vi.fn(),
  logRequested: vi.fn(),
  logAuthEvent: vi.fn(),
  logAuthError: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: hoisted.redirect,
}));

vi.mock("@/features/auth/email/issueOtpAndSendEmail", () => ({
  issueOtpAndSendEmailWithResult: hoisted.issueOtpAndSendEmailWithResult,
}));

vi.mock("@/features/auth/lib/issueOtp", () => ({
  createOtpIssueClient: hoisted.createOtpIssueClient,
}));

vi.mock("@/features/auth/lib/rate-limit/authGlobalRequestRateLimit", () => ({
  authGlobalRequestRateLimit: {
    tryConsume: hoisted.tryConsumeGlobal,
  },
}));

vi.mock("@/features/auth/lib/rate-limit/otpIssueRateLimit", () => ({
  otpIssueRateLimit: {
    tryStartIssue: hoisted.tryStartIssue,
    recordSuccessfulIssue: hoisted.recordSuccessfulIssue,
    releaseIssue: hoisted.releaseIssue,
  },
}));

vi.mock("@/features/auth/lib/rate-limit/trustedAuthClientIp", () => ({
  getTrustedAuthServerActionClientIp:
    hoisted.getTrustedAuthServerActionClientIp,
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

export type OtpIssueResultMode =
  | "success"
  | "provider_rate_limit"
  | "provider_error"
  | "invalid_provider_response"
  | "delivery_error"
  | "throw";

export type ForgotPasswordActionTestOptions = {
  email?: string;
  redirect?: string | null;
  ip?: string;
  trustedIpAvailable?: boolean;
  globalBlocked?: boolean;
  blockedBy?:
    | "email_success"
    | "cooldown"
    | "ip_short"
    | "ip_long"
    | "in_flight";
  issueResult?: OtpIssueResultMode;
};

export function makeFormData(input: { email: string }) {
  const formData = new FormData();
  formData.set("email", input.email);
  return formData;
}

export function buildVerifyOtpUrl(input: {
  email: string;
  redirect?: string | null;
}) {
  const params = new URLSearchParams({
    purpose: "reset-password",
    email: input.email.trim(),
  });

  if (input.redirect) {
    params.set("redirect", input.redirect);
  }

  return `/verify-otp?${params.toString()}`;
}

let originalAppUrl: string | undefined;
let originalAuthEmailFrom: string | undefined;

beforeEach(() => {
  originalAppUrl = process.env.APP_URL;
  originalAuthEmailFrom = process.env.AUTH_EMAIL_FROM;

  process.env.APP_URL = "https://example.com";
  process.env.AUTH_EMAIL_FROM = "no-reply@example.com";
});

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.APP_URL;
  } else {
    process.env.APP_URL = originalAppUrl;
  }

  if (originalAuthEmailFrom === undefined) {
    delete process.env.AUTH_EMAIL_FROM;
  } else {
    process.env.AUTH_EMAIL_FROM = originalAuthEmailFrom;
  }
});

function configureIssueResult(mode: OtpIssueResultMode): void {
  if (mode === "throw") {
    hoisted.issueOtpAndSendEmailWithResult.mockRejectedValue(
      new Error("unexpected error"),
    );
    return;
  }

  if (mode === "success") {
    hoisted.issueOtpAndSendEmailWithResult.mockResolvedValue({ ok: true });
    return;
  }

  hoisted.issueOtpAndSendEmailWithResult.mockResolvedValue({
    ok: false,
    kind: mode,
    diagnostic: {
      errorMessage: `${mode} message`,
      errorName: "TestError",
    },
  });
}

export function setupActionTest(options: ForgotPasswordActionTestOptions = {}) {
  vi.clearAllMocks();

  hoisted.redirect.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });

  const email = options.email ?? "user@example.com";
  const ip = options.ip ?? "203.0.113.10";
  const otpIssueClient = { kind: "otp-issue-client" };

  hoisted.createOtpIssueClient.mockReturnValue(otpIssueClient);
  hoisted.getTrustedAuthServerActionClientIp.mockResolvedValue(
    options.trustedIpAvailable === false
      ? { available: false, reasonCode: "IP_UNAVAILABLE" }
      : { available: true, ip },
  );

  hoisted.tryConsumeGlobal.mockReturnValue(
    options.globalBlocked
      ? { allowed: false, blockedBy: "ip_short" }
      : { allowed: true },
  );

  hoisted.tryStartIssue.mockReturnValue(
    options.blockedBy
      ? { allowed: false, blockedBy: options.blockedBy }
      : { allowed: true },
  );

  configureIssueResult(options.issueResult ?? "success");
  hoisted.applyMinimumActionDelay.mockResolvedValue(undefined);

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
    otpIssueClient,
    issueOtpAndSendEmailWithResultMock: hoisted.issueOtpAndSendEmailWithResult,
    createOtpIssueClientMock: hoisted.createOtpIssueClient,
    tryConsumeGlobalMock: hoisted.tryConsumeGlobal,
    tryStartIssueMock: hoisted.tryStartIssue,
    recordSuccessfulIssueMock: hoisted.recordSuccessfulIssue,
    releaseIssueMock: hoisted.releaseIssue,
    redirectMock: hoisted.redirect,
    applyMinimumActionDelayMock: hoisted.applyMinimumActionDelay,
    logRequestedMock: hoisted.logRequested,
    logAuthEventMock: hoisted.logAuthEvent,
    logAuthErrorMock: hoisted.logAuthError,
    getTrustedAuthServerActionClientIpMock:
      hoisted.getTrustedAuthServerActionClientIp,
  };
}

export function expectActionStateShape(state: unknown) {
  const typed = state as ForgotPasswordActionState;

  expect(typed).toHaveProperty("status");
  expect(typed).toHaveProperty("fieldErrors");

  expect(typed).not.toHaveProperty("code");
  expect(typed).not.toHaveProperty("success");
  expect(typed).not.toHaveProperty("data");
}

export function getTerminalEventCallCount(
  mocks: ReturnType<typeof setupActionTest>,
) {
  return getTerminalEventCalls(mocks).length;
}
