import { vi } from "vitest";
import { z } from "zod";

import { VALIDATION_MESSAGES } from "@/lib/validation/messages";
import { passwordFieldSchema } from "@/lib/validation/passwordSchema";

import {
  INITIAL_RESET_PASSWORD_ACTION_STATE,
  ResetPasswordActionState,
} from "../../resetPasswordActionState";

export const REDIRECT_ERROR = new Error("NEXT_REDIRECT");

const hoisted = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  redirect: vi.fn(),
  validateRedirectPath: vi.fn(),
  logRequested: vi.fn(),
  logAuthEvent: vi.fn(),
  logAuthError: vi.fn(),
  readSignedResetPasswordIntent: vi.fn(),
  verifyResetPasswordIntent: vi.fn(),
  clearSignedResetPasswordIntent: vi.fn(),
  isAuthError: vi.fn(),
  isAuthSessionMissingError: vi.fn(),
  resetPasswordActionSchema: { safeParse: vi.fn() },
  changePasswordSchema: { safeParse: vi.fn() },
  checkRequestEligibility: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  isAuthError: hoisted.isAuthError,
  isAuthSessionMissingError: hoisted.isAuthSessionMissingError,
}));

vi.mock("next/navigation", () => ({
  redirect: hoisted.redirect,
}));

vi.mock("@/features/auth/lib/validateRedirectPath", () => ({
  validateRedirectPath: hoisted.validateRedirectPath,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: hoisted.createClientMock,
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

vi.mock("@/features/auth/lib/signedResetPasswordIntent", () => ({
  readSignedResetPasswordIntent: hoisted.readSignedResetPasswordIntent,
  verifyResetPasswordIntent: hoisted.verifyResetPasswordIntent,
  clearSignedResetPasswordIntent: hoisted.clearSignedResetPasswordIntent,
}));

vi.mock(
  "@/features/auth/reset-password/schemas/resetPasswordActionSchema",
  () => ({
    resetPasswordActionSchema: hoisted.resetPasswordActionSchema,
  }),
);

vi.mock("@/features/mypage/schema", () => ({
  changePasswordSchema: hoisted.changePasswordSchema,
}));

vi.mock("@/features/auth/lib/checkRequestEligibility", () => ({
  checkRequestEligibility: hoisted.checkRequestEligibility,
}));

export function makeFormData(input: Record<string, string>) {
  const formData = new FormData();

  for (const [key, value] of Object.entries(input)) {
    formData.set(key, value);
  }

  return formData;
}

export function mockUser(user: object | null, error: unknown = null) {
  hoisted.getUser.mockResolvedValue({
    data: { user },
    error,
  });
}

export function mockUpdateUser(result: "success" | "error" | "throw") {
  if (result === "success") {
    hoisted.updateUser.mockResolvedValue({
      data: { user: {} },
      error: null,
    });
    return;
  }

  if (result === "error") {
    hoisted.updateUser.mockResolvedValue({
      data: { user: null },
      error: {
        status: 500,
        code: "unexpected_failure",
        message: "supabase error",
      },
    });
    return;
  }

  hoisted.updateUser.mockRejectedValue(new Error("network error"));
}

export function setupActionTest() {
  vi.clearAllMocks();

  hoisted.redirect.mockImplementation(() => {
    throw REDIRECT_ERROR;
  });

  hoisted.createClientMock.mockResolvedValue({
    auth: {
      getUser: hoisted.getUser,
      updateUser: hoisted.updateUser,
    },
  } as never);

  mockUser({ id: "reset-user-id" });
  mockUpdateUser("success");

  hoisted.isAuthError.mockReturnValue(false);
  hoisted.isAuthSessionMissingError.mockReturnValue(false);
  hoisted.readSignedResetPasswordIntent.mockResolvedValue(
    "signed-reset-intent",
  );
  hoisted.verifyResetPasswordIntent.mockReturnValue({
    purpose: "reset-password",
    userId: "reset-user-id",
    issuedAt: 1,
    expiresAt: 2,
  });
  hoisted.clearSignedResetPasswordIntent.mockResolvedValue(undefined);

  hoisted.validateRedirectPath.mockImplementation((input: unknown) =>
    typeof input === "string" && input.startsWith("/") ? input : "/mypage",
  );

  hoisted.resetPasswordActionSchema.safeParse.mockImplementation(
    (payload: unknown) => {
      const schema = z
        .object({
          password: passwordFieldSchema,
          confirmPassword: z.string(),
        })
        .strict()
        .superRefine((value, ctx) => {
          if (value.password !== value.confirmPassword) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: VALIDATION_MESSAGES.passwordMismatch,
              path: ["confirmPassword"],
            });
          }
        });

      const parsed = schema.safeParse(payload);

      if (parsed.success) {
        return parsed;
      }

      return {
        success: false,
        error: {
          flatten: () => parsed.error.flatten(),
        },
      };
    },
  );

  hoisted.changePasswordSchema.safeParse.mockReset();

  return {
    getUser: hoisted.getUser,
    updateUser: hoisted.updateUser,
    redirect: hoisted.redirect,
    validateRedirectPath: hoisted.validateRedirectPath,
    logRequested: hoisted.logRequested,
    logAuthEvent: hoisted.logAuthEvent,
    logAuthError: hoisted.logAuthError,
    readSignedResetPasswordIntent: hoisted.readSignedResetPasswordIntent,
    verifyResetPasswordIntent: hoisted.verifyResetPasswordIntent,
    clearSignedResetPasswordIntent: hoisted.clearSignedResetPasswordIntent,
    isAuthError: hoisted.isAuthError,
    isAuthSessionMissingError: hoisted.isAuthSessionMissingError,
    changePasswordSchema: hoisted.changePasswordSchema,
    checkRequestEligibility: hoisted.checkRequestEligibility,
    resetPasswordActionSchema: hoisted.resetPasswordActionSchema,
  };
}

export async function runResetPasswordAction(
  redirectValue: string | null,
  formData: FormData,
  prevState: ResetPasswordActionState = INITIAL_RESET_PASSWORD_ACTION_STATE,
) {
  const mod = await import("../../resetPasswordAction");

  return mod.resetPasswordAction(redirectValue, prevState, formData);
}
