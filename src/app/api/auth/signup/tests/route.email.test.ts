/**
 * 회원가입 API - 이메일 발송 분기 테스트 (정책 기준)
 *
 * 정책:
 * - 신규 사용자: 인증용 ticket 이메일 전송
 * - 기존 미인증 사용자: 인증용 ticket 이메일 전송
 * - 기존 인증 사용자: 인증정보 없는 notify ticket 이메일 전송
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { sendAuthEmail } from "@/features/auth/email/sendAuthEmail";
import { encryptTicket } from "@/features/auth/email/ticket";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { resetRateLimitStores } from "@/features/auth/signup/lib/checkSignupRateLimit";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";

import { POST } from "../route";
import { makeRequest } from "./utils/signupTestHelper";

vi.mock("@/features/auth/lib/getUserByEmail");
vi.mock("@/lib/supabase/admin");
vi.mock("@/features/auth/email/sendAuthEmail");
vi.mock("@/features/auth/email/ticket");

const TEST_TOKEN_HASH = "raw-token-hash-abc123";
const TEST_TICKET = "encrypted-ticket-xyz";

const requestBody = {
  email: "Test@Example.com",
  password: "Password123!",
  nickname: "테스터",
  agreements: { termsOfService: true as const, privacyPolicy: true as const },
};

const unverifiedUser = {
  email: "test@example.com",
  email_confirmed_at: null,
};

const verifiedUser = {
  email: "test@example.com",
  email_confirmed_at: "2026-03-29T00:00:00.000Z",
};

const mockGenerateLink = vi.fn();

beforeEach(() => {
  resetRateLimitStores();
  vi.clearAllMocks();

  vi.mocked(createAdminClient).mockReturnValue({
    auth: {
      admin: {
        generateLink: mockGenerateLink,
      },
    },
  } as never);

  vi.mocked(getUserByEmail).mockResolvedValue(null);
  vi.mocked(encryptTicket).mockReturnValue(TEST_TICKET);
  vi.mocked(sendAuthEmail).mockResolvedValue(undefined);

  mockGenerateLink.mockResolvedValue({
    data: {
      properties: {
        hashed_token: TEST_TOKEN_HASH,
        token_hash: TEST_TOKEN_HASH,
      },
      user: { id: "user-id", email: "test@example.com" },
    },
    error: null,
  });
});

describe("회원가입 이메일 발송 - 신규 사용자", () => {
  it("TC-01. 신규 사용자 분기에서 signup generateLink가 호출된다", async () => {
    await POST(makeRequest(requestBody));

    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "signup",
        email: "test@example.com",
        password: requestBody.password,
      }),
    );
  });

  it("TC-02. 신규 사용자 분기에서 sendAuthEmail이 1회 호출된다", async () => {
    await POST(makeRequest(requestBody));

    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(encryptTicket)).toHaveBeenCalledWith(
      `signup:${TEST_TOKEN_HASH}`,
    );
    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledWith(
      "test@example.com",
      TEST_TICKET,
      "verify-email",
    );
  });
});

describe("회원가입 이메일 발송 - 기존 미인증 사용자", () => {
  beforeEach(() => {
    vi.mocked(getUserByEmail).mockResolvedValue(unverifiedUser as never);
  });

  it("TC-03. 기존 미인증 사용자 분기에서 magiclink generateLink가 호출된다", async () => {
    await POST(makeRequest(requestBody));

    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "magiclink",
        email: "test@example.com",
      }),
    );
  });

  it("TC-04. 기존 미인증 사용자 분기에서 sendAuthEmail이 1회 호출된다", async () => {
    await POST(makeRequest(requestBody));

    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(encryptTicket)).toHaveBeenCalledWith(
      `magiclink:${TEST_TOKEN_HASH}`,
    );
    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledWith(
      "test@example.com",
      TEST_TICKET,
      "verify-email",
    );
  });
});

describe("회원가입 이메일 발송 - 기존 인증 사용자", () => {
  beforeEach(() => {
    vi.mocked(getUserByEmail).mockResolvedValue(verifiedUser as never);
  });

  it("TC-05. 기존 인증 사용자 분기에서도 sendAuthEmail이 호출된다", async () => {
    await POST(makeRequest(requestBody));

    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendAuthEmail)).toHaveBeenCalledWith(
      "test@example.com",
      expect.any(String),
      "verify-email",
    );
  });

  it("TC-06. 기존 인증 사용자 분기에서는 인증정보용 generateLink를 호출하지 않고, notify ticket은 encryptTicket으로 암호화한다", async () => {
    await POST(makeRequest(requestBody));

    expect(mockGenerateLink).toHaveBeenCalledTimes(0);
    expect(vi.mocked(encryptTicket)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(encryptTicket)).toHaveBeenCalledWith(
      expect.stringMatching(/^notify-/),
    );
  });

  it("TC-07. 기존 인증 사용자 메일 전송 실패는 외부 응답을 실패로 바꾸지 않는다", async () => {
    vi.mocked(sendAuthEmail).mockRejectedValue(new Error("SMTP error"));

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.code).toBe(AUTH_API_CODES.SIGNUP_SUCCESS);
    expect(body.data).toEqual({
      email: "test@example.com",
      redirectTo: ROUTES.LOGIN,
    });
  });
});
