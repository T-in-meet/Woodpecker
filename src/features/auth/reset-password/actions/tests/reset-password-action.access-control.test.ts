import { beforeEach, describe, expect, it } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

import {
  makeFormData,
  mockSession,
  REDIRECT_ERROR,
  runResetPasswordAction,
  setupActionTest,
} from "./utils/reset-password-action-test-utils";

describe("resetPasswordAction - access control", () => {
  let mocks: ReturnType<typeof setupActionTest>;

  beforeEach(() => {
    mocks = setupActionTest();
  });

  it("TC10: session 없음이면 ROUTES.FORGOT_PASSWORD로 redirect한다", async () => {
    mockSession(null);

    await expect(
      runResetPasswordAction(
        null,
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(mocks.redirect).toHaveBeenCalledWith(ROUTES.FORGOT_PASSWORD);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("reset-password intent cookie가 없으면 ROUTES.FORGOT_PASSWORD로 redirect한다", async () => {
    mocks.hasResetPasswordIntentCookie.mockResolvedValue(false);

    await expect(
      runResetPasswordAction(
        null,
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(mocks.redirect).toHaveBeenCalledWith(ROUTES.FORGOT_PASSWORD);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
