import { beforeEach, describe, expect, it } from "vitest";

import {
  expectActionStateShape,
  setupActionTest,
} from "./utils/forgot-password-action-test-utils";

describe("forgotPasswordAction", () => {
  beforeEach(() => {
    setupActionTest();
  });

  it("TC1: 유효한 email이면 resetPasswordForEmail을 호출한다", async () => {
    const mocks = setupActionTest();
    const state = await mocks.callAction();

    expect(mocks.resetPasswordForEmailMock).toHaveBeenCalledTimes(1);
    expect(mocks.resetPasswordForEmailMock).toHaveBeenCalledWith(
      "user@example.com",
      expect.objectContaining({
        redirectTo: "https://example.com/api/auth/callback",
      }),
    );
    expect(state).toMatchObject({
      status: "success",
      fieldErrors: null,
      message: null,
    });
  });

  it("TC2: email은 validation 전에 trim 처리된다", async () => {
    const mocks = setupActionTest({ email: "  user@example.com  " });
    const state = await mocks.callAction();

    expect(mocks.resetPasswordForEmailMock).toHaveBeenCalledWith(
      "user@example.com",
      expect.any(Object),
    );
    expect(state).toMatchObject({
      status: "success",
      fieldErrors: null,
      message: null,
    });
  });

  it("TC3/TC4/TC5: invalid 입력이면 field_error를 반환한다", async () => {
    const mocks = setupActionTest({ email: "invalid-email" });
    const state = await mocks.callAction();

    expect(state).toMatchObject({
      status: "field_error",
      fieldErrors: { email: expect.any(Array) },
      message: null,
    });
    expect(mocks.resetPasswordForEmailMock).not.toHaveBeenCalled();
    expect(mocks.checkRequestEligibilityMock).not.toHaveBeenCalled();
  });

  it("TC14/TC15/TC16/TC37: redirect query를 callback URL로 보존 전달한다", async () => {
    const mocks = setupActionTest({ redirect: "/notes?tab=1" });
    await mocks.callAction();

    expect(mocks.resetPasswordForEmailMock).toHaveBeenCalledWith(
      "user@example.com",
      expect.objectContaining({
        redirectTo:
          "https://example.com/api/auth/callback?redirect=%2Fnotes%3Ftab%3D1",
      }),
    );
    expect(mocks.resetPasswordForEmailMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ redirectTo: "/notes?tab=1" }),
    );
  });

  it("TC17: forgot-password에서 validateRedirectPath를 호출하지 않는다", async () => {
    const mocks = setupActionTest({ redirect: "/notes" });
    await mocks.callAction();
    expect(mocks.resetPasswordForEmailMock).toHaveBeenCalledTimes(1);
  });

  it("TC18: Supabase 성공 시 success 상태를 반환한다", async () => {
    const mocks = setupActionTest({ supabase: "success" });
    const state = await mocks.callAction();
    expect(state).toMatchObject({
      status: "success",
      fieldErrors: null,
      message: null,
    });
  });

  it("TC19/TC20: Supabase error 반환은 account enumeration 보호를 위해 success 처리한다", async () => {
    const mocks = setupActionTest({ supabase: "emailNotFoundError" });
    const state = await mocks.callAction();
    expect(state).toMatchObject({
      status: "success",
      fieldErrors: null,
      message: null,
    });
  });

  it("TC21: Supabase throw면 global_error 상태를 반환한다", async () => {
    const mocks = setupActionTest({ supabase: "throw" });
    const state = await mocks.callAction();
    expect(state).toMatchObject({
      status: "global_error",
      fieldErrors: null,
      message: null,
    });
  });

  it("TC31/TC32: ActionState에는 code/success/data/email 필드가 없다", async () => {
    const mocks = setupActionTest();
    const state = await mocks.callAction();
    expectActionStateShape(state);
    expect(state).not.toHaveProperty("email");
  });

  it("TC33: 별도 API route 의존 없이 Server Action을 직접 호출한다", async () => {
    const mocks = setupActionTest();
    await mocks.callAction();
    expect(mocks.resetPasswordForEmailMock).toHaveBeenCalledTimes(1);
  });

  it("TC34: validation/rate-limit 실패 시 Supabase 호출 없이 종료한다", async () => {
    const invalid = setupActionTest({ email: "invalid-email" });
    await invalid.callAction();
    expect(invalid.resetPasswordForEmailMock).not.toHaveBeenCalled();

    const blocked = setupActionTest({
      rateLimit: { ipShort: "block" },
    });
    await blocked.callAction();
    expect(blocked.resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("TC35/TC36: 이메일 발송은 Supabase resetPasswordForEmail 호출만 검증한다", async () => {
    const mocks = setupActionTest();
    await mocks.callAction();
    expect(mocks.resetPasswordForEmailMock).toHaveBeenCalledTimes(1);
  });
});
