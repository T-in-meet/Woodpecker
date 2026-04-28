import { beforeEach, describe, expect, it } from "vitest";

import { RESET_REQUIRED_COOKIE_NAME } from "@/features/auth/constants/cookies";

import {
  makeFormData,
  mockUpdateUser,
  REDIRECT_ERROR,
  runResetPasswordAction,
  setupActionTest,
} from "./utils/reset-password-action-test-utils";

describe("resetPasswordAction - cookie", () => {
  beforeEach(() => {
    setupActionTest();
  });

  it("TC2: 성공 시 reset-required cookie를 삭제한다", async () => {
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

    expect(mocks.cookieDelete).toHaveBeenCalledWith(RESET_REQUIRED_COOKIE_NAME);
  });

  it("TC14: updateUser 실패 시 cookie delete 미호출", async () => {
    const mocks = setupActionTest();
    mockUpdateUser("error");
    await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("TC16: updateUser throw 시 cookie delete 미호출", async () => {
    const mocks = setupActionTest();
    mockUpdateUser("throw");
    await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("TC28: cookie delete는 name 기준 호출만 검증하고 option은 검증하지 않는다", async () => {
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
    expect(mocks.cookieDelete).toHaveBeenCalledWith(RESET_REQUIRED_COOKIE_NAME);
    expect(mocks.cookieDelete).toHaveBeenCalledTimes(1);
  });
});
