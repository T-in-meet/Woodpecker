/**
 * VerifyEmailPageClient 행동 테스트
 *
 * 설계 의도:
 * - 사용자가 관찰할 수 있는 DOM 변화와 API 호출만 검증한다.
 * - 내부 상태(useState 값)나 구현 세부 사항은 검증하지 않는다.
 * - state-rules.md에 따라 API 경계(global.fetch)만 mock하고,
 *   나머지는 실제 컴포넌트 로직을 그대로 실행한다.
 *
 * 검증 범위:
 * - 안내 메시지, 이메일 input, 재발송 버튼 렌더링
 * - email prop으로 input pre-fill
 * - 버튼 클릭 → POST /api/auth/resend-verification-email 호출
 * - 요청 중(isSubmitting) 버튼 비활성화
 * - 성공/429 응답별 토스트 메시지 표시
 *
 * mock 대상:
 * - global.fetch (API boundary)
 *
 * 타이머 전략:
 * - vi.useFakeTimers로 비동기 흐름을 안정적으로 제어한다.
 * - userEvent.setup에 advanceTimers를 연결해 user-event 내부 딜레이도 fake timer로 제어한다.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { showToast } from "@/lib/utils/showToast";

import VerifyEmailPageClient from "./VerifyEmailPageClient";

vi.mock("@/lib/utils/showToast", () => ({
  showToast: vi.fn(),
}));

const RATE_LIMIT_TOAST_MESSAGE =
  "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";

// API 응답 팩토리 함수 — 실제 서버 응답 계약을 반영한다.
// 각 케이스별 mock Response를 일관된 형태로 생성해 테스트 간 중복을 줄인다.
function makeFetchResponse(status: number, body: object) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

// 200: 인증 메일 재발송 성공
function makeSuccessResponse() {
  return makeFetchResponse(200, {
    success: true,
    code: AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS,
    data: { email: "test@example.com", resent: true },
  });
}

// 429: 서버 rate limit 초과 — 파괴적 토스트를 표시한다.
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
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

function createDeferredResponse(status: number, body: object) {
  let resolver: ((response: Response) => void) | undefined;
  const promise = new Promise<Response>((resolve) => {
    resolver = resolve;
  });

  return {
    promise,
    resolve: () => {
      resolver?.(
        new Response(JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      );
    },
  };
}

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
  it("TC-06. 요청 중에는 버튼이 비활성화된다", async () => {
    const deferred = createDeferredResponse(200, {
      success: true,
      code: AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS,
      data: { email: "test@example.com", resent: true },
    });
    vi.spyOn(global, "fetch").mockReturnValueOnce(deferred.promise);
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<VerifyEmailPageClient email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /인증 메일 재발송/i }),
      ).toBeDisabled();
    });

    deferred.resolve();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /인증 메일 재발송/i }),
      ).toBeEnabled();
    });
  });

  it("TC-07. 성공 응답 시 성공 토스트가 표시된다", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(makeSuccessResponse());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<VerifyEmailPageClient email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("인증 메일이 재발송되었습니다.");
    });
  });

  it("TC-08. 성공 응답 시 파괴적 토스트는 표시되지 않는다", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(makeSuccessResponse());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<VerifyEmailPageClient email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("인증 메일이 재발송되었습니다.");
    });
    expect(showToast).not.toHaveBeenCalledWith(
      RATE_LIMIT_TOAST_MESSAGE,
      "destructive",
    );
  });
});

describe("VerifyEmailPageClient - 429 Rate Limit 응답", () => {
  it("TC-09. 429 응답 시 generic rate-limit 토스트를 표시한다", async () => {
    vi.spyOn(global, "fetch").mockReturnValueOnce(makeRateLimitResponse());
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<VerifyEmailPageClient email="test@example.com" />);

    await user.click(screen.getByRole("button", { name: /인증 메일 재발송/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        RATE_LIMIT_TOAST_MESSAGE,
        "destructive",
      );
    });
  });
});
