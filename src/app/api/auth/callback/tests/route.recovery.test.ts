import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import { GET } from "../route";

const { applyMinimumResponseTimeMock } = vi.hoisted(() => ({
  applyMinimumResponseTimeMock: vi.fn(
    async (_start: number, response: Response) => response,
  ),
}));

vi.mock("@/features/auth/lib/applyMinimumResponseTime", () => ({
  applyMinimumResponseTime: applyMinimumResponseTimeMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const verifyOtp = vi.fn();

function makeRequest(params: {
  token_hash?: string;
  type?: string;
  redirect?: string;
}): NextRequest {
  const url = new URL("http://localhost/api/auth/callback");
  if (params.token_hash !== undefined) {
    url.searchParams.set("token_hash", params.token_hash);
  }
  if (params.type !== undefined) {
    url.searchParams.set("type", params.type);
  }
  if (params.redirect !== undefined) {
    url.searchParams.set("redirect", params.redirect);
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

function expectInvalidResetRedirect(response: Response): void {
  const location = response.headers.get("location") ?? "";
  expect(location).toContain(
    `${ROUTES.FORGOT_PASSWORD}?error=invalid_reset_link`,
  );
}

describe("callback recovery 분기", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["APP_URL"] = "https://app.example.com";
    vi.mocked(createClient).mockResolvedValue({
      auth: { verifyOtp },
    } as never);
    verifyOtp.mockResolvedValue({ data: { user: {} }, error: null });
  });

  it("TC1: token_hash + type=recovery면 verifyOtp({ token_hash, type: recovery })를 호출한다", async () => {
    await GET(makeRequest({ token_hash: "valid-token", type: "recovery" }));

    expect(verifyOtp).toHaveBeenCalledTimes(1);
    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "valid-token",
      type: "recovery",
    });
  });

  it("TC2: token_hash가 없으면 verifyOtp를 호출하지 않고 invalid_reset_link로 redirect한다", async () => {
    const response = await GET(makeRequest({ type: "recovery" }));

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expectInvalidResetRedirect(response);
  });

  it("TC3: unsupported type이면 verifyOtp를 호출하지 않고 verify-email로 redirect한다", async () => {
    const response = await GET(
      makeRequest({ token_hash: "valid-token", type: "signup" }),
    );

    expect(verifyOtp).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(ROUTES.VERIFY_EMAIL);
  });

  // callback에서는 redirect를 검증하지 않고 reset-password 단계로 보존 전달한다.
  // 최종 redirect 검증은 reset-password action에서 수행한다.
  it("TC4: 성공 시 APP_URL origin 기반 /reset-password로 이동하고 redirect query를 보존한다", async () => {
    const response = await GET(
      makeRequest({
        token_hash: "valid-token",
        type: "recovery",
        redirect: "/notes",
      }),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toBe(
      `https://app.example.com${ROUTES.RESET_PASSWORD}?redirect=%2Fnotes`,
    );
  });

  it("TC5: verifyOtp가 error를 반환하면 invalid_reset_link로 redirect한다", async () => {
    verifyOtp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "invalid" },
    });

    const response = await GET(
      makeRequest({ token_hash: "valid-token", type: "recovery" }),
    );

    expect(response.status).toBe(307);
    expectInvalidResetRedirect(response);
  });

  it("TC6: verifyOtp가 throw하면 invalid_reset_link로 redirect한다", async () => {
    verifyOtp.mockRejectedValueOnce(new Error("boom"));

    const response = await GET(
      makeRequest({ token_hash: "valid-token", type: "recovery" }),
    );

    expect(response.status).toBe(307);
    expectInvalidResetRedirect(response);
  });

  it("TC7: 모든 분기에서 applyMinimumResponseTime을 호출한다", async () => {
    await GET(makeRequest({ token_hash: "valid-token", type: "recovery" }));
    await GET(makeRequest({ type: "recovery" }));
    await GET(makeRequest({ token_hash: "valid-token", type: "signup" }));

    verifyOtp.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "invalid" },
    });
    await GET(makeRequest({ token_hash: "valid-token", type: "recovery" }));

    verifyOtp.mockRejectedValueOnce(new Error("boom"));
    await GET(makeRequest({ token_hash: "valid-token", type: "recovery" }));

    expect(applyMinimumResponseTimeMock).toHaveBeenCalledTimes(5);
  });

  it("TC8: type=magiclink은 recovery가 아니라 magiclink 타입으로 verifyOtp를 호출한다", async () => {
    await GET(makeRequest({ token_hash: "valid-token", type: "magiclink" }));

    expect(verifyOtp).toHaveBeenCalledWith({
      token_hash: "valid-token",
      type: "magiclink",
    });
  });
});
