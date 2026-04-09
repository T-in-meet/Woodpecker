/**
 * VerifyEmailPageClient 행동 테스트
 *
 * 검증 범위:
 * - 안내 메시지, 이메일 input, 재발송 버튼 렌더링
 * - email prop으로 input pre-fill
 * - 버튼 클릭 → POST /api/auth/resend-verification-email 호출
 * - 성공 → 버튼 비활성화 + 60초 쿨다운 타이머 표시 → 만료 후 재활성화
 * - 409(cooldown) → 쿨다운 타이머 표시
 * - 429(rate limit) → 에러 메시지 표시
 *
 * mock 대상:
 * - global.fetch (API boundary)
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";

import VerifyEmailPageClient from "./VerifyEmailPageClient";

function makeFetchResponse(status: number, body: object) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function makeSuccessResponse() {
  return makeFetchResponse(200, {
    success: true,
    code: AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS,
    data: { email: "test@example.com", resent: true },
  });
}

function makeCooldownResponse() {
  return makeFetchResponse(409, {
    success: false,
    code: AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_COOLDOWN_CONFLICT,
    data: null,
  });
}

function makeRateLimitResponse() {
  return makeFetchResponse(429, {
    success: false,
    code: AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED,
    data: null,
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("VerifyEmailPageClient - 렌더링", () => {
  it("TC-01. 안내 메시지가 렌더링된다", () => {
    render(<VerifyEmailPageClient />);

    expect(screen.getByText(/회원가입이 완료되었습니다/)).toBeInTheDocument();
    expect(screen.getByText(/인증 이메일을 확인해주세요/)).toBeInTheDocument();
  });

  it("TC-02. 이메일 input과 재발송 버튼이 렌더링된다", () => {
    render(<VerifyEmailPageClient />);

    expect(
      screen.getByRole("textbox", { name: /이메일/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /인증 메일 재발송/i }),
    ).toBeInTheDocument();
  });

  it("TC-03. email prop이 있으면 input에 pre-fill된다", () => {
    render(<VerifyEmailPageClient email="prefill@example.com" />);

    expect(screen.getByRole("textbox", { name: /이메일/i })).toHaveValue(
      "prefill@example.com",
    );
  });

  it("TC-04. email prop이 없으면 input이 비어있다", () => {
    render(<VerifyEmailPageClient />);

    expect(screen.getByRole("textbox", { name: /이메일/i })).toHaveValue("");
  });
});

describe("VerifyEmailPageClient - API 호출", () => {
  it("TC-05. 이메일 입력 후 버튼 클릭 시 올바른 email로 API가 호출된다", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockReturnValueOnce(makeSuccessResponse());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<VerifyEmailPageClient />);

    await user.type(
      screen.getByRole("textbox", { name: /이메일/i }),
      "test@example.com",
    );
    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/auth/resend-verification-email",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ email: "test@example.com" }),
        }),
      );
    });
  });
});

describe("VerifyEmailPageClient - 성공 응답", () => {
  it("TC-06. 성공 응답 후 버튼이 비활성화된다", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(makeSuccessResponse());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<VerifyEmailPageClient email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /인증 메일 재발송/i }),
      ).toBeDisabled();
    });
  });

  it("TC-07. 성공 응답 후 남은 쿨다운 시간이 버튼에 표시된다", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(makeSuccessResponse());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<VerifyEmailPageClient email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /60/ })).toBeInTheDocument();
    });
  });

  it("TC-08. 60초 쿨다운 만료 후 버튼이 다시 활성화된다", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(makeSuccessResponse());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<VerifyEmailPageClient email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /인증 메일 재발송/i }),
      ).toBeDisabled();
    });

    await vi.advanceTimersByTimeAsync(60_000);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /인증 메일 재발송/i }),
      ).toBeEnabled();
    });
  });
});

describe("VerifyEmailPageClient - 409 쿨다운 응답", () => {
  it("TC-09. 409 응답 시 쿨다운 타이머가 표시된다", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(makeCooldownResponse());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<VerifyEmailPageClient email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /60/ })).toBeInTheDocument();
    });
  });
});

describe("VerifyEmailPageClient - 429 Rate Limit 응답", () => {
  it("TC-10. 429 응답 시 에러 메시지가 표시된다", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(makeRateLimitResponse());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<VerifyEmailPageClient email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
