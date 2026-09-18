import { beforeEach, describe, expect, it } from "vitest";

import {
  makeFormData,
  mockUpdateUser,
  REDIRECT_ERROR,
  runResetPasswordAction,
  setupActionTest,
} from "./utils/reset-password-action-test-utils";

describe("resetPasswordAction - supabase", () => {
  let mocks: ReturnType<typeof setupActionTest>;

  beforeEach(() => {
    mocks = setupActionTest();
  });

  it("valid signed Reset Intent를 현재 user id로 검증한 뒤 updateUser({ password })를 호출한다", async () => {
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
      token: "signed-reset-intent",
      expectedUserId: "reset-user-id",
    });
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
    expect(mocks.updateUser).toHaveBeenCalledWith({
      password: "valid-password",
    });
    expect(mocks.updateUser).not.toHaveBeenCalledWith(
      expect.objectContaining({
        confirmPassword: expect.anything(),
      }),
    );
  });

  it("updateUser error 반환이면 internal_error state를 반환하고 signed Intent를 유지한다", async () => {
    mockUpdateUser("error");

    const state = await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );

    expect(state).toEqual({ status: "internal_error" });
    expect(mocks.clearSignedResetPasswordIntent).not.toHaveBeenCalled();
  });

  it("updateUser가 same_password error를 반환하면 signed Intent를 유지한다", async () => {
    mocks.updateUser.mockResolvedValueOnce({
      error: {
        status: 422,
        code: "same_password",
      },
    });

    const state = await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );

    expect(state).toEqual({
      reason: "same_password",
      status: "internal_error",
    });
    expect(mocks.clearSignedResetPasswordIntent).not.toHaveBeenCalled();
  });

  it("updateUser throw면 internal_error state를 반환하고 signed Intent를 유지한다", async () => {
    mockUpdateUser("throw");

    const state = await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );

    expect(state).toEqual({ status: "internal_error" });
    expect(state).not.toHaveProperty("reason");
    expect(mocks.clearSignedResetPasswordIntent).not.toHaveBeenCalled();
  });
});
