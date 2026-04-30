import { beforeEach, describe, expect, it } from "vitest";

import {
  makeFormData,
  mockUpdateUser,
  REDIRECT_ERROR,
  runResetPasswordAction,
  setupActionTest,
} from "./utils/reset-password-action-test-utils";

describe("resetPasswordAction - policy", () => {
  let mocks: ReturnType<typeof setupActionTest>;

  beforeEach(() => {
    mocks = setupActionTest();
  });

  it("TC24: Supabase error 상세를 사용자 메시지로 노출하지 않는다", async () => {
    mockUpdateUser("error");
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

  it("TC25: checkRequestEligibility를 호출하지 않는다", async () => {
    await expect(
      runResetPasswordAction(
        null,
        makeFormData({
          password: "valid-password",
          confirmPassword: "valid-password",
        }),
      ),
    ).rejects.toBe(REDIRECT_ERROR);
    expect(mocks.checkRequestEligibility).not.toHaveBeenCalled();
  });
});
