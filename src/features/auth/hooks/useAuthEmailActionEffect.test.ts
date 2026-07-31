import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { showToast } from "@/lib/utils/showToast";

import { AUTH_GLOBAL_ERROR_MESSAGE } from "../constants/messages";
import { RATE_LIMIT_TOAST_MESSAGE } from "../errors/rateLimitError";
import { useAuthEmailActionEffect } from "./useAuthEmailActionEffect";

vi.mock("@/lib/utils/showToast", () => ({
  showToast: vi.fn(),
}));

describe("useAuthEmailActionEffect", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("invalid_input 상태이면 email field error를 설정한다", () => {
    const setError = vi.fn();

    renderHook(() =>
      useAuthEmailActionEffect({
        state: {
          status: "invalid_input",
          fieldErrors: {
            email: ["이메일 형식이 올바르지 않습니다."],
          },
        },
        setError,
      }),
    );

    expect(setError).toHaveBeenCalledWith("email", {
      type: "server",
      message: "이메일 형식이 올바르지 않습니다.",
    });
    expect(showToast).not.toHaveBeenCalled();
  });

  it("invalid_input 상태이지만 email error가 없으면 아무 처리도 하지 않는다", () => {
    const setError = vi.fn();

    renderHook(() =>
      useAuthEmailActionEffect({
        state: {
          status: "invalid_input",
          fieldErrors: {},
        },
        setError,
      }),
    );

    expect(setError).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("blocked 상태이면 rate limit toast를 표시한다", () => {
    const setError = vi.fn();

    renderHook(() =>
      useAuthEmailActionEffect({
        state: {
          status: "blocked",
          fieldErrors: null,
          reasonCode: "RATE_LIMIT_EMAIL_SHORT",
        },
        setError,
      }),
    );

    expect(setError).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(RATE_LIMIT_TOAST_MESSAGE, {
      variant: "destructive",
      dedupeKey: "auth-rate-limit",
    });
  });

  it("internal_error 상태이면 공통 오류 toast를 표시한다", () => {
    const setError = vi.fn();

    renderHook(() =>
      useAuthEmailActionEffect({
        state: {
          status: "internal_error",
          fieldErrors: null,
          reasonCode: "INTERNAL_ERROR",
        },
        setError,
      }),
    );

    expect(setError).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(AUTH_GLOBAL_ERROR_MESSAGE, {
      variant: "destructive",
      dedupeKey: "auth-global-error",
    });
  });

  it("idle 상태이면 아무 처리도 하지 않는다", () => {
    const setError = vi.fn();

    renderHook(() =>
      useAuthEmailActionEffect({
        state: {
          status: "idle",
          fieldErrors: null,
        },
        setError,
      }),
    );

    expect(setError).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });

  it("invalid_request 상태이면 아무 처리도 하지 않는다", () => {
    const setError = vi.fn();

    renderHook(() =>
      useAuthEmailActionEffect({
        state: {
          status: "invalid_request",
          fieldErrors: null,
          reasonCode: "SCHEMA_VALIDATION_FAILED",
        },
        setError,
      }),
    );

    expect(setError).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });
});
