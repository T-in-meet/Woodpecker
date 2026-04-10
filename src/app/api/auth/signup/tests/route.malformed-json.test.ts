/**
 * 회원가입 API - malformed JSON 입력 처리 테스트
 *
 * 이 파일은 Content-Type이 application/json이지만
 * 본문이 유효하지 않은 JSON일 때의 처리만 검증한다.
 *
 * 검증 항목:
 * - 400 응답 및 응답 계약(success, code, data.errors) 준수
 * - validation 이전 단계이므로 외부 의존 호출이 전혀 발생하지 않음
 */

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { resetEligibilityStore } from "@/features/auth/lib/checkRequestEligibility";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { createClient } from "@/lib/supabase/server";

import { POST } from "../route";

vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/lib/supabase/server");

function makeMalformedJsonRequest(): NextRequest {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{ invalid json }",
  });
}

beforeEach(() => {
  resetEligibilityStore();
  vi.clearAllMocks();
});

describe("회원가입 - malformed JSON 처리", () => {
  it("TC-01. malformed JSON 요청 시 400 validation 실패 응답을 반환한다", async () => {
    const response = await POST(makeMalformedJsonRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_INVALID_INPUT);
    expect(Array.isArray(body.data.errors)).toBe(true);
    expect(body.data.errors.length).toBeGreaterThanOrEqual(1);
    expect(body.data.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: expect.any(String),
          reason: expect.any(String),
        }),
      ]),
    );
  });

  it("TC-02. malformed JSON 요청 시 외부 의존 호출이 전혀 발생하지 않는다", async () => {
    await POST(makeMalformedJsonRequest());

    expect(createClient).toHaveBeenCalledTimes(0);
    expect(getUserByEmail).toHaveBeenCalledTimes(0);
  });
});
