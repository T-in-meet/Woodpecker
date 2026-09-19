/**
 * 로그인 API 입력 검증 전용 테스트.
 *
 * trusted IP 및 Auth Global request guard를 통과한 뒤 validation이 실행된다.
 * validation 실패는 operation-specific Login Rate Limit consume과 Provider 호출 전에 종료되어야 한다.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { authGlobalRequestRateLimit } from "@/features/auth/lib/rate-limit/authGlobalRequestRateLimit";
import { getTrustedAuthClientIp } from "@/features/auth/lib/rate-limit/trustedAuthClientIp";
import { loginRateLimit } from "@/features/auth/login/lib/loginRateLimit";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

import { POST } from "../route";
import {
  makeLoginRequest,
  mockLoginSuccess,
  mockSignIn,
  resetLoginApiMocks,
  setupLoginApiMocks,
  setupLoginSecurityMocks,
} from "./utils/loginTestHelper";

const getLegalAcceptanceStatusMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/lib/rate-limit/authGlobalRequestRateLimit", () => ({
  authGlobalRequestRateLimit: {
    tryConsume: vi.fn(),
  },
}));
vi.mock("@/features/auth/lib/rate-limit/trustedAuthClientIp", () => ({
  getTrustedAuthClientIp: vi.fn(),
}));
vi.mock("@/features/auth/lib/userAgreements", () => ({
  getLegalAcceptanceStatus: getLegalAcceptanceStatusMock,
}));
vi.mock("@/features/auth/login/lib/loginRateLimit", () => ({
  loginRateLimit: {
    tryStartAttempt: vi.fn(),
    recordResult: vi.fn(),
  },
}));
vi.mock("@/lib/supabase/server");

describe("로그인 API 입력 검증", () => {
  beforeEach(() => {
    resetLoginApiMocks();
    setupLoginApiMocks();
    setupLoginSecurityMocks();
    mockLoginSuccess();
    getLegalAcceptanceStatusMock.mockResolvedValue({ canAccessService: true });
    vi.mocked(authGlobalRequestRateLimit.tryConsume).mockReturnValue({
      allowed: true,
    });
  });

  /**
   * 검증 실패 응답의 공통 계약을 확인한다.
   *
   * @param response Login API 응답
   * @param field 실패 필드
   * @param reason validation reason
   */
  async function expectValidationFailure(
    response: Response,
    field: string,
    reason: string,
  ): Promise<void> {
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.LOGIN_INVALID_INPUT);
    expect(body.data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ field, reason })]),
    );
  }

  describe("필수값 누락", () => {
    it("TC-01: 이메일 누락 시 400 + LOGIN_INVALID_INPUT을 반환한다", async () => {
      const response = await POST(
        makeLoginRequest({ password: "Password123!" }),
      );

      await expectValidationFailure(
        response,
        "email",
        VALIDATION_REASON.REQUIRED,
      );
    });

    it("TC-02: 비밀번호 누락 시 400 + LOGIN_INVALID_INPUT을 반환한다", async () => {
      const response = await POST(
        makeLoginRequest({ email: "user@example.com" }),
      );

      await expectValidationFailure(
        response,
        "password",
        VALIDATION_REASON.REQUIRED,
      );
    });

    it("TC-03: 이메일이 빈 문자열이면 REQUIRED로 실패한다", async () => {
      const response = await POST(
        makeLoginRequest({ email: "", password: "Password123!" }),
      );

      await expectValidationFailure(
        response,
        "email",
        VALIDATION_REASON.REQUIRED,
      );
    });

    it("TC-04: 비밀번호가 빈 문자열이면 REQUIRED로 실패한다", async () => {
      const response = await POST(
        makeLoginRequest({ email: "user@example.com", password: "" }),
      );

      await expectValidationFailure(
        response,
        "password",
        VALIDATION_REASON.REQUIRED,
      );
    });
  });

  describe("형식 오류", () => {
    it("TC-05: 이메일 형식이 아니면 INVALID_FORMAT reason으로 실패한다", async () => {
      const response = await POST(
        makeLoginRequest({
          email: "not-an-email",
          password: "Password123!",
        }),
      );

      await expectValidationFailure(
        response,
        "email",
        VALIDATION_REASON.INVALID_FORMAT,
      );
    });

    it("TC-06: trim 후에도 이메일 형식이 올바르지 않으면 실패한다", async () => {
      const response = await POST(
        makeLoginRequest({
          email: "  invalid  ",
          password: "Password123!",
        }),
      );

      await expectValidationFailure(
        response,
        "email",
        VALIDATION_REASON.INVALID_FORMAT,
      );
    });
  });

  describe("strict mode", () => {
    it("TC-07: extra field가 포함되면 400 + LOGIN_INVALID_INPUT을 반환한다", async () => {
      const response = await POST(
        makeLoginRequest({
          email: "user@example.com",
          password: "Password123!",
          extraField: "should-fail",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe(AUTH_API_CODES.LOGIN_INVALID_INPUT);
    });

    it("TC-08: redirect가 body에 포함되면 400 + LOGIN_INVALID_INPUT을 반환한다", async () => {
      const response = await POST(
        makeLoginRequest({
          email: "user@example.com",
          password: "Password123!",
          redirect: "/notes",
        }),
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe(AUTH_API_CODES.LOGIN_INVALID_INPUT);
    });
  });

  describe("malformed JSON", () => {
    it("TC-09: Content-Type이 application/json이 아니면 400을 반환한다", async () => {
      const { NextRequest } = await import("next/server");
      const request = new NextRequest("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "not json",
      });

      const response = await POST(request);
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.code).toBe(AUTH_API_CODES.LOGIN_INVALID_INPUT);
    });
  });

  describe("검증 실패 시 후속 처리 차단", () => {
    it("TC-10: validation 실패 시 global guard까지 실행하고 operation limiter/Provider는 시작하지 않는다", async () => {
      await POST(makeLoginRequest({ email: "bad-email", password: "pass" }));

      expect(getTrustedAuthClientIp).toHaveBeenCalled();
      expect(authGlobalRequestRateLimit.tryConsume).toHaveBeenCalled();
      expect(loginRateLimit.tryStartAttempt).not.toHaveBeenCalled();
      expect(mockSignIn).not.toHaveBeenCalled();
    });
  });
});
