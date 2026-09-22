import { beforeEach, describe, expect, it } from "vitest";

import {
  makeFormData,
  mockUpdateUser,
  runResetPasswordAction,
  setupActionTest,
} from "./utils/reset-password-action-test-utils";

describe("resetPasswordAction - policy", () => {
  beforeEach(() => {
    setupActionTest();
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
      status: "internal_error",
    });
  });
});
