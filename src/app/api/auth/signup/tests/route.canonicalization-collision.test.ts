/**
 * 이메일 정규화(Canonicalization) collision 테스트
 *
 * 목적:
 * - Gmail alias가 동일 canonical identity로 취급되는지 검증
 * - spec invariant: gmail_aliases_must_map_to_same_identity
 *
 * 시나리오:
 * 1. user@gmail.com 가입
 * 2. user+tag@gmail.com 재시도 → 기존 사용자 분기
 * 3. u.s.e.r@gmail.com 재시도 → 기존 사용자 분기
 * 4. non-Gmail plus/dot → 다른 canonical
 *
 * 검증:
 * - getUserByEmail이 canonical email으로 호출되는지 확인
 * - 동일 canonical 별칭들이 기존 사용자로 감지되는지 확인
 * - OTP 전환 이후에도 응답 계약(SIGNUP_SUCCESS, VERIFY_OTP redirect)이 유지되는지 확인
 * - Account enumeration 방어 원칙 유지
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { issueOtpAndSendEmail } from "@/features/auth/email/issueOtpAndSendEmail";
import { resetEligibilityStore } from "@/features/auth/lib/checkRequestEligibility";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/features/auth/email/issueOtpAndSendEmail");
vi.mock("@/lib/supabase/admin");

beforeEach(() => {
  resetEligibilityStore();
  vi.clearAllMocks();
  process.env["EMAIL_TICKET_SECRET"] = "test-ticket-secret";

  const mockCreateUser = vi.fn();

  vi.mocked(createAdminClient).mockReturnValue({
    auth: {
      admin: { createUser: mockCreateUser },
    },
  } as never);

  mockCreateUser.mockResolvedValue({
    data: { user: { id: "user-id", email: "test@example.com" } },
    error: null,
  });

  vi.mocked(getUserByEmail).mockResolvedValue(null);
  vi.mocked(issueOtpAndSendEmail).mockResolvedValue(undefined);
});

describe("회원가입 - Gmail alias collision (canonicalization)", () => {
  const validPassword = "Password123!";
  const validNickname = "tester";
  const agreements = {
    termsOfService: true as const,
    privacyPolicy: true as const,
  };

  const unverifiedUser = {
    email: "u.s.e.r+legacy@gmail.com", // auth.users의 raw email (canonical과 의도적으로 다름)
    email_confirmed_at: null,
  };

  describe("TC-01: user+tag@gmail.com과 user@gmail.com은 동일 canonical", () => {
    it("기존 사용자(user@gmail.com)를 user+tag@gmail.com로 조회 시 → canonical이 동일하여 기존 사용자로 감지", async () => {
      // 기존 사용자 조회 → canonical email(user@gmail.com)로 호출
      vi.mocked(getUserByEmail).mockResolvedValueOnce(unverifiedUser as never);

      const response = await POST(
        makeRequest({
          email: "user+tag@gmail.com",
          password: validPassword,
          nickname: validNickname,
          agreements,
        }),
      );

      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);

      // getUserByEmail이 canonical email(user@gmail.com)로 호출되었는지 확인
      expect(vi.mocked(getUserByEmail)).toHaveBeenCalledWith("user@gmail.com");

      // 발송은 canonical이 아니라 existingUser.email(raw) 기준으로 호출
      expect(vi.mocked(issueOtpAndSendEmail)).toHaveBeenCalledWith({
        email: "u.s.e.r+legacy@gmail.com",
        purpose: "signup",
      });
    });

    it("응답은 동일한 SIGNUP_SUCCESS 계약 유지", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);

      const response = await POST(
        makeRequest({
          email: "user+tag@gmail.com",
          password: validPassword,
          nickname: validNickname,
          agreements,
        }),
      );

      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
      expect(body.data).toHaveProperty("email");
      expect(body.data).toHaveProperty("redirectTo");
      expect(body.data.redirectTo).toBe(
        `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent("user+tag@gmail.com")}`,
      );
    });
  });

  describe("TC-02: u.s.e.r@gmail.com과 user@gmail.com은 동일 canonical", () => {
    it("dot 제거 규칙으로 인해 동일 canonical 매핑", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);

      const response = await POST(
        makeRequest({
          email: "u.s.e.r@gmail.com",
          password: validPassword,
          nickname: validNickname,
          agreements,
        }),
      );

      expect(response.status).toBe(200);

      // canonical email(user@gmail.com)로 호출
      expect(vi.mocked(getUserByEmail)).toHaveBeenCalledWith("user@gmail.com");
    });
  });

  describe("TC-03: 복합 규칙 (plus + dot 모두 제거)", () => {
    it("u.s.e.r+tag@gmail.com도 user@gmail.com으로 정규화", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);

      const response = await POST(
        makeRequest({
          email: "u.s.e.r+tag@gmail.com",
          password: validPassword,
          nickname: validNickname,
          agreements,
        }),
      );

      expect(response.status).toBe(200);
      expect(vi.mocked(getUserByEmail)).toHaveBeenCalledWith("user@gmail.com");
    });
  });

  describe("TC-04: non-Gmail domain은 plus/dot 보존", () => {
    it("user+tag@company.com과 user@company.com은 서로 다른 canonical", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      const response1 = await POST(
        makeRequest({
          email: "user@company.com",
          password: validPassword,
          nickname: validNickname,
          agreements,
        }),
      );

      expect(response1.status).toBe(200);

      // user+tag@company.com을 시도 → 다른 canonical
      vi.mocked(getUserByEmail).mockResolvedValue(null); // 다른 사용자

      const response2 = await POST(
        makeRequest({
          email: "user+tag@company.com",
          password: validPassword,
          nickname: validNickname,
          agreements,
        }),
      );

      expect(response2.status).toBe(200);

      // getUserByEmail이 각각 다른 canonical로 호출되었는지 확인
      expect(vi.mocked(getUserByEmail)).toHaveBeenNthCalledWith(
        1,
        "user@company.com",
      );
      expect(vi.mocked(getUserByEmail)).toHaveBeenNthCalledWith(
        2,
        "user+tag@company.com",
      );
    });

    it("user.name@company.com도 dot이 보존되어 user@company.com과 다름", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(null);

      const response = await POST(
        makeRequest({
          email: "user.name@company.com",
          password: validPassword,
          nickname: validNickname,
          agreements,
        }),
      );

      expect(response.status).toBe(200);

      // non-Gmail이므로 dot 그대로 유지
      expect(vi.mocked(getUserByEmail)).toHaveBeenCalledWith(
        "user.name@company.com",
      );
    });
  });

  describe("TC-05: googlemail.com도 gmail.com으로 통일", () => {
    it("user@googlemail.com과 user@gmail.com은 동일 canonical", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);

      const response = await POST(
        makeRequest({
          email: "user@googlemail.com",
          password: validPassword,
          nickname: validNickname,
          agreements,
        }),
      );

      expect(response.status).toBe(200);

      // canonical: user@gmail.com (domain 통일)
      expect(vi.mocked(getUserByEmail)).toHaveBeenCalledWith("user@gmail.com");
    });
  });

  describe("TC-06: Account enumeration 방어 원칙 유지", () => {
    it("Google alias도 account enumeration 방어 적용 (응답 계약 동일)", async () => {
      vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);

      const response = await POST(
        makeRequest({
          email: "user+tag@gmail.com",
          password: validPassword,
          nickname: validNickname,
          agreements,
        }),
      );

      const body = await response.json();

      // 응답 계약 확인
      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
      expect(body.data).toHaveProperty("email");
      expect(body.data.redirectTo).toBe(
        `${ROUTES.VERIFY_OTP}?purpose=signup&email=${encodeURIComponent("user+tag@gmail.com")}`,
      );
    });
  });
});
