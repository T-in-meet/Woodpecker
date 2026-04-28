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

  it("TC13: updateUser error 반환이면 global_error state 반환", async () => {
    mockUpdateUser("error");
    const state = await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );
    expect(state).toEqual({
      status: "global_error",
      message: "비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.",
    });
  });

  it("TC15: updateUser throw면 global_error state 반환", async () => {
    mockUpdateUser("throw");
    const state = await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "valid-password",
      }),
    );
    expect(state).toEqual({
      status: "global_error",
      message: "비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.",
    });
  });
});
