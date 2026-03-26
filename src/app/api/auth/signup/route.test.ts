import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_CODES } from "@/lib/constants/apiCodes";
import { createClient } from "@/lib/supabase/server";

import { POST } from "./route";

vi.mock("@/lib/supabase/server");

describe("POST /api/auth/signup", () => {
  const mockSignUp = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: { signUp: mockSignUp },
    } as never);
  });

  function makeRequest(body: object): NextRequest {
    return new NextRequest("http://localhost/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const requestBody = {
    email: "Test@Example.com",
    password: "Password123!",
    nickname: "테스터",
  };

  const mockSignUpSuccess = () => {
    mockSignUp.mockResolvedValue({
      data: { user: { email: "test@example.com" } },
      error: null,
    });
  };

  it("신규 이메일 요청 시 signUp이 1회 호출된다", async () => {
    mockSignUpSuccess();

    await POST(makeRequest(requestBody));

    expect(mockSignUp).toHaveBeenCalledTimes(1);
  });

  it("이메일은 소문자로 정규화되어 signUp에 전달된다", async () => {
    mockSignUpSuccess();

    await POST(makeRequest(requestBody));

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "test@example.com" }),
    );
  });

  it("signUp 호출 시 options.emailRedirectTo는 /login 경로를 포함한다", async () => {
    mockSignUpSuccess();

    await POST(makeRequest(requestBody));

    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining("/login"),
        }),
      }),
    );
  });

  it("API는 201 Created를 반환한다", async () => {
    mockSignUpSuccess();

    const response = await POST(makeRequest(requestBody));

    expect(response.status).toBe(201);
  });

  it("성공 응답 body는 success true, code SIGNUP_SUCCESS, data 객체를 포함한다", async () => {
    mockSignUpSuccess();

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.code).toBe(API_CODES.SIGNUP_SUCCESS);
    expect(body.data).not.toBeNull();
    expect(typeof body.data).toBe("object");
  });

  it("성공 응답 data.email은 소문자로 정규화된 이메일이다", async () => {
    mockSignUpSuccess();

    const response = await POST(makeRequest(requestBody));
    const body = await response.json();

    expect(body.data.email).toBe("test@example.com");
  });
});
