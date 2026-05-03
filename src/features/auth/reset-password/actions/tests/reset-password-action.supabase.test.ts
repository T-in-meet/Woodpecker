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

  it("TC1: valid input + session + cookie면 updateUser({ password }) 호출", async () => {
    await expect(
      runResetPasswordAction(
        null,
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);

    expect(mocks.updateUser).toHaveBeenCalledWith({
      password: "valid-password",
    });
    expect(mocks.updateUser).not.toHaveBeenCalledWith(
      expect.objectContaining({
        confirmPassword: expect.anything(),
      }),
    );
  });

  it("TC13: updateUser error 반환이면 internal_error state 반환", async () => {
    mockUpdateUser("error");
    const state = await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );
    expect(state).toEqual({
      status: "internal_error",
    });
  });

  it("TC14: updateUser가 same_password error를 반환하면 동일 비밀번호 메시지로 internal_error state를 반환한다", async () => {
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
  });

  it("TC15: updateUser throw면 internal_error state 반환", async () => {
    mockUpdateUser("throw");
    const state = await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );
    expect(state).toEqual({
      status: "internal_error",
    });
    expect(state).not.toHaveProperty("reason");
  });
});
