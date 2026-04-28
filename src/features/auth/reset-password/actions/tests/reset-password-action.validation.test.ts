import { beforeEach, describe, expect, it } from "vitest";

import { PASSWORD_MIN_LENGTH } from "@/lib/constants/user";

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

  it("TC6: validation 실패 시 field_error state를 반환한다", async () => {
    const state = await runResetPasswordAction(
      null,
      makeFormData({ password: "short", confirmPassword: "short" }),
    );
    expect(state).toMatchObject({
      status: "field_error",
      fieldErrors: { password: expect.any(Array) },
    });
    expect(state).toMatchObject({
      fieldErrors: {
        password: [`비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다`],
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
      status: "field_error",
      fieldErrors: {
        confirmPassword: ["비밀번호가 일치하지 않습니다."],
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
    expect(mocks.cookieDelete).not.toHaveBeenCalled();
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
    expect(state).toMatchObject({ status: "field_error" });
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
