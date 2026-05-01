import { beforeEach, describe, expect, it } from "vitest";

import {
  PASSWORD_MIN_LENGTH_MESSAGE,
  PASSWORD_MISMATCH_MESSAGE,
} from "@/features/auth/constants/messages";

import {
  makeFormData,
  REDIRECT_ERROR,
  runResetPasswordAction,
  setupActionTest,
} from "./utils/reset-password-action-test-utils";

describe("resetPasswordAction - validation", () => {
  beforeEach(() => {
    setupActionTest();
  });

  it("TC6: validation 실패 시 invalid_input state를 반환한다", async () => {
    const state = await runResetPasswordAction(
      null,
      makeFormData({ password: "short", confirmPassword: "short" }),
    );
    expect(state).toMatchObject({
      status: "invalid_input",
      fieldErrors: { password: expect.any(Array) },
    });
    expect(state).toMatchObject({
      fieldErrors: {
        password: [PASSWORD_MIN_LENGTH_MESSAGE],
      },
    });
  });

  it("TC7: confirmPassword mismatch면 confirmPassword field error를 반환한다", async () => {
    const state = await runResetPasswordAction(
      null,
      makeFormData({
        password: "valid-password",
        confirmPassword: "different-password",
      }),
    );
    expect(state).toMatchObject({
      status: "invalid_input",
      fieldErrors: {
        confirmPassword: [PASSWORD_MISMATCH_MESSAGE],
      },
    });
  });

  it("TC8: validation 실패 시 updateUser/cookie delete/redirect를 호출하지 않는다", async () => {
    const mocks = setupActionTest();
    await runResetPasswordAction(
      null,
      makeFormData({ password: "short", confirmPassword: "short" }),
    );
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("TC9: extra field 포함 시 validation 실패 처리한다", async () => {
    const mocks = setupActionTest();
    const form = makeFormData({
      password: "valid-password",
      confirmPassword: "valid-password",
      role: "admin",
    } as Record<string, string>);
    const state = await runResetPasswordAction(null, form);
    expect(state).toMatchObject({ status: "invalid_input" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("TC26: redirect는 payload schema 대상이 아니다", async () => {
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
    expect(mocks.resetPasswordActionSchema.safeParse).toHaveBeenCalledWith({
      password: "valid-password",
      confirmPassword: "valid-password",
    });
  });

  it("TC27: resetPasswordActionSchema를 사용한다", async () => {
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
    expect(mocks.resetPasswordActionSchema.safeParse).toHaveBeenCalledTimes(1);
    expect(mocks.changePasswordSchema.safeParse).not.toHaveBeenCalled();
  });
});
