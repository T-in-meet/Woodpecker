import { beforeEach, describe, expect, it, vi } from "vitest";

const clearSignedResetPasswordIntentMock = vi.hoisted(() => vi.fn());
const clearSetPasswordIntentMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/lib/signedResetPasswordIntent", () => ({
  clearSignedResetPasswordIntent: clearSignedResetPasswordIntentMock,
}));

vi.mock("@/features/auth/lib/setPasswordIntent", () => ({
  clearSetPasswordIntent: clearSetPasswordIntentMock,
}));

import { ROUTES } from "@/lib/constants/routes";

import { GET } from "./route";

describe("reset password intent cleanup route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSignedResetPasswordIntentMock.mockResolvedValue(undefined);
  });

  it("signed Reset Intent를 clear한 뒤 fixed MyPage로 redirect한다", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/auth/reset-password/cleanup"),
    );

    expect(clearSignedResetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.MYPAGE}`,
    );
  });

  it("request query가 있어도 fixed MyPage destination을 변경하지 않는다", async () => {
    const response = await GET(
      new Request(
        "http://localhost:3000/api/auth/reset-password/cleanup?redirect=https%3A%2F%2Fevil.example&origin=evil&userId=other-user",
      ),
    );

    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.MYPAGE}`,
    );
  });

  it("Reset cleanup은 Set Intent clear helper를 호출하지 않는다", async () => {
    await GET(
      new Request("http://localhost:3000/api/auth/reset-password/cleanup"),
    );

    expect(clearSignedResetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(clearSetPasswordIntentMock).not.toHaveBeenCalled();
  });

  it("signed Reset Intent clear가 실패하면 오류를 전파한다", async () => {
    const clearError = new Error("reset intent clear failed");
    clearSignedResetPasswordIntentMock.mockRejectedValue(clearError);

    await expect(
      GET(new Request("http://localhost:3000/api/auth/reset-password/cleanup")),
    ).rejects.toBe(clearError);
  });
});
