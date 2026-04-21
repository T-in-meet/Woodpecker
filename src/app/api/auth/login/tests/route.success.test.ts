/**
 * 로그인 API 성공 흐름 전용 테스트
 *
 * 검증 범위:
 * - 200 OK + LOGIN_SUCCESS 응답 계약
 * - data.redirectTo 반환 (기본값 /mypage, 유효한 redirect query 반영)
 * - 잘못된 redirect query → /mypage fallback
 * - signInWithPassword 호출 여부 및 인자
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

vi.mock("@/lib/supabase/server");
vi.mock("@/lib/utils/getClientIp", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

describe("로그인 API 성공 흐름", () => {
  beforeEach(() => {
    resetEligibilityStore();
    resetLoginApiMocks();
    setupLoginApiMocks();
    mockLoginSuccess();
  });

  it("TC-01: 올바른 자격 증명이면 200을 반환한다", async () => {
    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));

    expect(response.status).toBe(200);
  });

  it("TC-02: 성공 응답 body는 success true, code LOGIN_SUCCESS를 포함한다", async () => {
    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.LOGIN_SUCCESS);
  });

  it("TC-03: redirect query가 없으면 data.redirectTo는 /mypage이다", async () => {
    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    expect(body.data.redirectTo).toBe("/mypage");
  });

  it("TC-04: 유효한 redirect query가 있으면 data.redirectTo에 반영된다", async () => {
    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY, "/notes"));
    const body = await response.json();

    expect(body.data.redirectTo).toBe("/notes");
  });

  it("TC-05: 차단된 redirect query(/login)가 있으면 data.redirectTo는 /mypage로 fallback된다", async () => {
    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY, "/login"));
    const body = await response.json();

    // 차단 경로는 validateRedirectPath가 /mypage로 fallback 처리
    expect(body.data.redirectTo).toBe("/mypage");
  });

  it("TC-06: /notes/123 dynamic route redirect는 data.redirectTo에 반영된다", async () => {
    const response = await POST(
      makeLoginRequest(DEFAULT_LOGIN_BODY, "/notes/123"),
    );
    const body = await response.json();

    expect(body.data.redirectTo).toBe("/notes/123");
  });

  it("TC-07: signInWithPassword는 canonicalize된 이메일로 호출된다", async () => {
    // 이메일 대소문자 정규화 확인 — canonicalizeEmail이 적용됨
    await POST(
      makeLoginRequest({ email: "User@Example.COM", password: "Password123!" }),
    );

    expect(mockSignIn).toHaveBeenCalledWith(
      expect.objectContaining({ email: "user@example.com" }),
    );
  });

  it("TC-08: 성공 응답 data는 redirectTo만 포함한다", async () => {
    const response = await POST(makeLoginRequest(DEFAULT_LOGIN_BODY));
    const body = await response.json();

    // 계정 상태를 추론할 수 있는 필드가 없어야 함
    expect(Object.keys(body.data)).toEqual(["redirectTo"]);
  });
});
