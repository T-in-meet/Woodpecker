import { beforeEach, describe, expect, it } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

import {
  makeFormData,
  REDIRECT_ERROR,
  runResetPasswordAction,
  setupActionTest,
} from "./utils/reset-password-action-test-utils";

describe("resetPasswordAction - redirect", () => {
  beforeEach(() => {
    setupActionTest();
  });

  it("TC3: 성공 + redirect 없음이면 /mypage redirect", async () => {
    const mocks = setupActionTest();
    await expect(
      runResetPasswordAction(
        null,
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);
    expect(mocks.redirect).toHaveBeenCalledWith(ROUTES.MYPAGE);
  });

  it("TC4: 성공 + valid redirect면 validateRedirectPath 후 해당 경로 redirect", async () => {
    const mocks = setupActionTest();
    await expect(
      runResetPasswordAction(
        "/notes",
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);
    expect(mocks.validateRedirectPath).toHaveBeenCalledWith("/notes");
    expect(mocks.redirect).toHaveBeenCalledWith("/notes");
  });

  it("TC5: 성공 + invalid redirect면 /mypage fallback", async () => {
    const mocks = setupActionTest();
    mocks.validateRedirectPath.mockReturnValueOnce(ROUTES.MYPAGE);
    await expect(
      runResetPasswordAction(
        "https://evil.com",
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);
    expect(mocks.validateRedirectPath).toHaveBeenCalledWith("https://evil.com");
    expect(mocks.redirect).toHaveBeenCalledWith(ROUTES.MYPAGE);
  });

  it("TC17: 성공/rejected는 state 반환이 아니라 redirect 종료", async () => {
    await expect(
      runResetPasswordAction(
        null,
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);
  });
});
