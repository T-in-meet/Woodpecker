/**
 * 로그인 API 입력 검증 전용 테스트
 *
 * 검증 범위:
 * - 필수값 누락 → 400 + LOGIN_INVALID_INPUT
 * - 이메일 형식 오류 → INVALID_FORMAT reason
 * - malformed JSON → INVALID_INPUT
 * - extra field → INVALID_INPUT (strict mode)
 * - 검증 실패 시 signInWithPassword 호출 차단
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { resetEligibilityStore } from "@/features/auth/lib/checkRequestEligibility";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

import { POST } from "../route";
import {
  makeLoginRequest,
  mockLoginSuccess,
  mockSignIn,
  resetLoginApiMocks,
  setupLoginApiMocks,
} from "./utils/loginTestHelper";

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/utils/getClientIp", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

describe("로그인 API 입력 검증", () => {
  beforeEach(() => {
    resetEligibilityStore();
    resetLoginApiMocks();
    setupLoginApiMocks();
    mockLoginSuccess();
  });

  /** 검증 실패 응답의 공통 계약을 확인하는 헬퍼 */
  async function expectValidationFailure(
    response: Response,
    field: string,
    reason: string,
  ) {
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

    it("TC-03: 이메일이 빈 문자열이면 400 + LOGIN_INVALID_INPUT을 반환한다", async () => {
      const response = await POST(
        makeLoginRequest({ email: "", password: "Password123!" }),
      );
      await expectValidationFailure(
        response,
        "email",
        VALIDATION_REASON.REQUIRED,
      );
    });

    it("TC-04: 비밀번호가 빈 문자열이면 400 + LOGIN_INVALID_INPUT을 반환한다", async () => {
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
        makeLoginRequest({ email: "not-an-email", password: "Password123!" }),
      );
      await expectValidationFailure(
        response,
        "email",
        VALIDATION_REASON.INVALID_FORMAT,
      );
    });

    it("TC-06: 이메일 앞뒤 공백 trim 후 형식이 올바르지 않으면 실패한다", async () => {
      const response = await POST(
        makeLoginRequest({ email: "  invalid  ", password: "Password123!" }),
      );
      await expectValidationFailure(
        response,
        "email",
        VALIDATION_REASON.INVALID_FORMAT,
      );
    });
  });

  describe("strict mode — 허용되지 않은 필드 거부", () => {
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

  describe("검증 실패 시 외부 호출 차단", () => {
    it("TC-10: 검증 실패 시 signInWithPassword가 호출되지 않는다", async () => {
      await POST(makeLoginRequest({ email: "bad-email", password: "pass" }));
      expect(mockSignIn).not.toHaveBeenCalled();
    });
  });
});
