import { afterEach, beforeEach, expect, vi } from "vitest";

import { AUTH_EVENTS } from "@/features/auth/constants/authEvents";
import { resetEligibilityStore } from "@/features/auth/lib/requestEligibilityStore";

import {
  type ForgotPasswordActionState,
  INITIAL_FORGOT_PASSWORD_ACTION_STATE,
} from "../../forgotPasswordAction";

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
  createClientMock: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  getServerActionClientIp: vi.fn(),
  applyMinimumActionDelay: vi.fn(),
  logRequested: vi.fn(),
  logAuthEvent: vi.fn(),
  logAuthError: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: hoisted.createClientMock,
}));

vi.mock("@/lib/utils/getServerActionClientIp", () => ({
  getServerActionClientIp: hoisted.getServerActionClientIp,
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

export type SupabaseMode = "success" | "error" | "emailNotFoundError" | "throw";

export type ForgotPasswordActionTestOptions = {
  email?: string;
  redirect?: string | null;
  ip?: string;
  supabase?: SupabaseMode;
};

export function makeFormData(input: { email: string }) {
  const formData = new FormData();
  formData.set("email", input.email);
  return formData;
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

let originalAppUrl: string | undefined;

beforeEach(() => {
  originalAppUrl = process.env.APP_URL;
  process.env.APP_URL = "https://example.com";
});

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.APP_URL;
  } else {
    process.env.APP_URL = originalAppUrl;
  }
});

export function setupActionTest(options: ForgotPasswordActionTestOptions = {}) {
  vi.clearAllMocks();
  resetEligibilityStore();

  hoisted.createClientMock.mockResolvedValue({
    auth: {
      resetPasswordForEmail: hoisted.resetPasswordForEmail,
    },
  } as never);

  const email = options.email ?? "user@example.com";

  hoisted.getServerActionClientIp.mockResolvedValue(
    options.ip ?? "203.0.113.10",
  );

  hoisted.applyMinimumActionDelay.mockResolvedValue(undefined);

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
    getServerActionClientIp: hoisted.getServerActionClientIp,
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

export function getTerminalEventCallCount(mocks: {
  logAuthEventMock: { mock: { calls: unknown[][] } };
  logAuthErrorMock: { mock: { calls: unknown[][] } };
}) {
  return (
    mocks.logAuthEventMock.mock.calls.length +
    mocks.logAuthErrorMock.mock.calls.length
  );
}
