import { beforeEach, describe, expect, it, vi } from "vitest";

const clearSetPasswordIntentMock = vi.hoisted(() => vi.fn());
const clearSignedResetPasswordIntentMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/lib/setPasswordIntent", () => ({
  clearSetPasswordIntent: clearSetPasswordIntentMock,
}));

vi.mock("@/features/auth/lib/signedResetPasswordIntent", () => ({
  clearSignedResetPasswordIntent: clearSignedResetPasswordIntentMock,
}));

import { ROUTES } from "@/lib/constants/routes";

import { GET } from "./route";

describe("set password intent cleanup route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSetPasswordIntentMock.mockResolvedValue(undefined);
  });

  it("Set Intent를 clear한 뒤 fixed mypage로 redirect한다", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/auth/set-password/cleanup"),
    );

    expect(clearSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.MYPAGE}`,
    );
  });

  it("request query가 있어도 fixed mypage destination을 변경하지 않는다", async () => {
    const response = await GET(
      new Request(
        "http://localhost:3000/api/auth/set-password/cleanup?redirect=https%3A%2F%2Fevil.example&origin=evil&userId=other-user",
      ),
    );

    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.MYPAGE}`,
    );
  });

  it("legacy next query가 다시 들어와도 destination으로 사용하지 않고 fixed mypage로 보낸다", async () => {
    const response = await GET(
      new Request(
        "http://localhost:3000/api/auth/set-password/cleanup?next=%2Fnotes",
      ),
    );

    expect(clearSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get("location")).toBe(
      `http://localhost:3000${ROUTES.MYPAGE}`,
    );
    expect(response.headers.get("location")).not.toBe(
      "http://localhost:3000/notes",
    );
  });

  it("Set cleanup은 Reset Intent clear helper를 호출하지 않는다", async () => {
    await GET(
      new Request("http://localhost:3000/api/auth/set-password/cleanup"),
    );

    expect(clearSetPasswordIntentMock).toHaveBeenCalledTimes(1);
    expect(clearSignedResetPasswordIntentMock).not.toHaveBeenCalled();
  });

  it("Set Intent clear가 실패하면 오류를 전파한다", async () => {
    const clearError = new Error("set intent clear failed");
    clearSetPasswordIntentMock.mockRejectedValue(clearError);

    await expect(
      GET(new Request("http://localhost:3000/api/auth/set-password/cleanup")),
    ).rejects.toBe(clearError);
  });
});
