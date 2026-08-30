/**
 * 로그인 API 인증 실패 통합 처리 전용 테스트
 *
 * 핵심 검증:
 * - 모든 인증 실패 케이스(존재하지 않는 계정, 비밀번호 불일치, 미인증, 기타)가
 *   외부에서 동일한 응답(401 + LOGIN_INVALID_CREDENTIALS)으로 통합됨
 * - account enumeration 방어: 응답 구조 차이 없음
 * - 내부 시스템 오류는 별도로 500 + LOGIN_INTERNAL_ERROR로 처리됨
 *
 * spec 근거: login-spec.md §4.7 Authentication Failure Integration
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { resetEligibilityStore } from "@/features/auth/lib/checkRequestEligibility";
import { createClient } from "@/lib/supabase/server";

import { POST } from "../route";
import {
  DEFAULT_LOGIN_BODY,
  makeLoginRequest,
  mockLoginSuccess,
  mockSignIn,
  resetLoginApiMocks,
  setupLoginApiMocks,
} from "./utils/loginTestHelper";

const getLegalAcceptanceStatusMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/lib/userAgreements", () => ({
  getLegalAcceptanceStatus: getLegalAcceptanceStatusMock,
}));
vi.mock("@/lib/supabase/server");
vi.mock("@/lib/utils/getClientIp", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

describe("로그인 API 인증 실패 통합 처리", () => {
  beforeEach(() => {
    resetEligibilityStore();
    resetLoginApiMocks();
    setupLoginApiMocks();
    mockLoginSuccess();
    getLegalAcceptanceStatusMock.mockResolvedValue({ canAccessService: true });
  });

  describe("인증 실패 응답 통합 — account enumeration 방어", () => {
    const authFailureCases = [
      {
        label: "존재하지 않는 계정",
        error: { message: "Invalid login credentials", status: 400 },
      },
      {
        label: "비밀번호 불일치",
        error: { message: "Invalid login credentials", status: 400 },
      },
      {
        label: "이메일 미인증 계정",
        error: { message: "Email not confirmed", status: 400 },
      },
      {
        label: "기타 인증 실패",
        error: { message: "Unknown auth error", status: 500 },
      },
    ];

    for (const { label, error } of authFailureCases) {
      it(`TC: ${label}일 때 401 + LOGIN_INVALID_CREDENTIALS를 반환한다`, async () => {
        mockSignIn.mockResolvedValue({ data: null, error });

        const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
        const body = await response.json();

        // 모든 인증 실패는 외부에서 동일하게 처리되어야 함
        expect(response.status).toBe(401);
        expect(body.code).toBe(AUTH_API_CODES.LOGIN_INVALID_CREDENTIALS);
        expect(body.success).toBe(false);
        expect(body.data).toBeNull();
      });
    }

    it("TC: 4가지 인증 실패 케이스의 응답 구조가 모두 동일하다", async () => {
      const errors = [
        { message: "Invalid login credentials", status: 400 },
        { message: "Email not confirmed", status: 400 },
        { message: "User not found", status: 404 },
        { message: "Unknown error", status: 500 },
      ];

      const responses = await Promise.all(
        errors.map(async (error) => {
          mockSignIn.mockResolvedValue({ data: null, error });
          const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
          return response.json();
        }),
      );

      // 모든 응답이 동일한 구조를 가져야 함 — 차이가 있으면 enumeration 가능
      const [first, ...rest] = responses;
      for (const body of rest) {
        expect(body.success).toBe(first.success);
        expect(body.code).toBe(first.code);
        expect(body.data).toEqual(first.data);
      }
    });
  });

  describe("내부 시스템 오류", () => {
    it("TC: signInWithPassword가 예외를 throw하면 500 + LOGIN_INTERNAL_ERROR를 반환한다", async () => {
      mockSignIn.mockRejectedValue(new Error("unexpected db error"));

      const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.code).toBe(AUTH_API_CODES.LOGIN_INTERNAL_ERROR);
      expect(body.success).toBe(false);
      expect(body.data).toBeNull();
    });

    it("TC: createClient가 예외를 throw하면 500 + LOGIN_INTERNAL_ERROR를 반환한다", async () => {
      vi.mocked(createClient).mockRejectedValue(
        new Error("supabase init failed"),
      );

      const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.code).toBe(AUTH_API_CODES.LOGIN_INTERNAL_ERROR);
    });
  });

  describe("응답 계약 일관성 — 인증 실패와 내부 오류의 구조 비교", () => {
    it("TC: 인증 실패와 내부 오류 모두 data는 null이다", async () => {
      mockSignIn.mockResolvedValue({
        data: null,
        error: { message: "Invalid credentials" },
      });
      const credResponse = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
      const credBody = await credResponse.json();
      expect(credBody.data).toBeNull();

      mockSignIn.mockRejectedValue(new Error("system error"));
      const sysResponse = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
      const sysBody = await sysResponse.json();
      expect(sysBody.data).toBeNull();
    });
  });
});
