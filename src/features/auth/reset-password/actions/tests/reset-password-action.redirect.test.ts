import { beforeEach, describe, expect, it } from "vitest";

import { RESET_PASSWORD_INTENT_CLEANUP_PATH } from "@/features/auth/constants/routes";
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

  it("성공 + redirect 없음이면 /mypage redirect", async () => {
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

  it("성공 + valid redirect면 validateRedirectPath 후 해당 경로 redirect", async () => {
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

  it("성공 + invalid redirect면 /mypage fallback", async () => {
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

  it("성공/rejected는 state 반환이 아니라 redirect 종료", async () => {
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

  it("비밀번호 재설정 완료 후 signed Reset Intent를 direct clear한다", async () => {
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

    expect(mocks.clearSignedResetPasswordIntent).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).toHaveBeenCalledWith(ROUTES.MYPAGE);
  });

  it("direct clear 실패면 정상 redirectPath를 버리고 cleanup Route로 전환한다", async () => {
    const mocks = setupActionTest();
    mocks.clearSignedResetPasswordIntent.mockRejectedValue(
      new Error("reset intent clear failed"),
    );

    await expect(
      runResetPasswordAction(
        "/notes",
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    expect(mocks.clearSignedResetPasswordIntent).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).toHaveBeenCalledWith(
      RESET_PASSWORD_INTENT_CLEANUP_PATH,
    );
    expect(mocks.redirect).not.toHaveBeenCalledWith("/notes");
  });
});
