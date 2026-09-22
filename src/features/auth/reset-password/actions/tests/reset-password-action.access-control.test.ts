import { beforeEach, describe, expect, it } from "vitest";

import { RESET_PASSWORD_INTENT_CLEANUP_PATH } from "@/features/auth/constants/routes";
import { ROUTES } from "@/lib/constants/routes";

import {
  makeFormData,
  mockUser,
  REDIRECT_ERROR,
  runResetPasswordAction,
  setupActionTest,
} from "./utils/reset-password-action-test-utils";

describe("resetPasswordAction - access control", () => {
  let mocks: ReturnType<typeof setupActionTest>;

  beforeEach(() => {
    mocks = setupActionTest();
  });

  it("authenticated user가 없으면 Intent를 읽지 않고 FORGOT_PASSWORD로 redirect한다", async () => {
    mockUser(null);

    await expect(
      runResetPasswordAction(
        null,
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(mocks.readSignedResetPasswordIntent).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith(ROUTES.FORGOT_PASSWORD);
  });

  it("Auth session missing error는 unauthenticated로 처리한다", async () => {
    const sessionMissingError = new Error("Auth session missing!");
    mocks.isAuthSessionMissingError.mockReturnValueOnce(true);
    mockUser(null, sessionMissingError);

    await expect(
      runResetPasswordAction(
        null,
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(mocks.readSignedResetPasswordIntent).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith(ROUTES.FORGOT_PASSWORD);
  });

  it("getUser system error는 invalid로 downgrade하지 않고 internal_error를 반환한다", async () => {
    mockUser(null, new Error("get user failed"));

    const result = await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );

    expect(result).toEqual({ status: "internal_error" });
    expect(mocks.readSignedResetPasswordIntent).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("signed Reset Intent가 missing이면 clear 없이 FORGOT_PASSWORD로 redirect한다", async () => {
    mocks.readSignedResetPasswordIntent.mockResolvedValue(null);

    await expect(
      runResetPasswordAction(
        null,
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(mocks.verifyResetPasswordIntent).not.toHaveBeenCalled();
    expect(mocks.clearSignedResetPasswordIntent).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith(ROUTES.FORGOT_PASSWORD);
  });

  it("signed Reset Intent read system error는 missing으로 downgrade하지 않고 internal_error를 반환한다", async () => {
    mocks.readSignedResetPasswordIntent.mockRejectedValue(
      new Error("reset intent read failed"),
    );

    const result = await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );

    expect(result).toEqual({ status: "internal_error" });
    expect(mocks.verifyResetPasswordIntent).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.clearSignedResetPasswordIntent).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("signed Reset Intent verifier가 null이면 update 없이 cleanup으로 보낸다", async () => {
    mocks.verifyResetPasswordIntent.mockReturnValue(null);

    await expect(
      runResetPasswordAction(
        "/notes",
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.clearSignedResetPasswordIntent).not.toHaveBeenCalled();
    expect(mocks.validateRedirectPath).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith(
      RESET_PASSWORD_INTENT_CLEANUP_PATH,
    );
  });

  it('legacy "verified" 값은 signed verifier를 통과하지 못하고 cleanup으로 보낸다', async () => {
    mocks.readSignedResetPasswordIntent.mockResolvedValue("verified");
    mocks.verifyResetPasswordIntent.mockReturnValue(null);

    await expect(
      runResetPasswordAction(
        null,
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(mocks.verifyResetPasswordIntent).toHaveBeenCalledWith({
      token: "verified",
      expectedUserId: "reset-user-id",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.redirect).toHaveBeenCalledWith(
      RESET_PASSWORD_INTENT_CLEANUP_PATH,
    );
  });

  it("Reset verifier system error는 invalid cleanup으로 downgrade하지 않는다", async () => {
    mocks.verifyResetPasswordIntent.mockImplementation(() => {
      throw new Error("signing secret unavailable");
    });

    const result = await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );

    expect(result).toEqual({ status: "internal_error" });
    expect(mocks.clearSignedResetPasswordIntent).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
