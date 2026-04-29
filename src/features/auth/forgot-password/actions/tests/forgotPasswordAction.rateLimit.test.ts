import { describe, expect, it } from "vitest";

import { setupActionTest } from "./utils/forgot-password-action-test-utils";

describe("forgotPasswordAction - rate limit", () => {
  it("TC6: canonicalEmail 기준으로 rate limit을 평가한다", async () => {
    const mocks = setupActionTest({ email: "User@Example.COM" });
    await mocks.callAction();

    expect(mocks.canonicalizeEmailMock).toHaveBeenCalledWith(
      "User@Example.COM",
    );
    expect(mocks.checkRequestEligibilityMock).toHaveBeenCalledWith(
      "forgot-password",
      "203.0.113.10",
      "user@example.com",
    );
  });

  it("TC7: IP short 차단 시 global_error를 반환한다", async () => {
    const mocks = setupActionTest({ rateLimit: { ipShort: "block" } });
    const state = await mocks.callAction();

    expect(state).toMatchObject({
      status: "global_error",
      fieldErrors: null,
      message: null,
    });
    expect(mocks.resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("TC8: IP long 차단 시 global_error를 반환한다", async () => {
    const mocks = setupActionTest({ rateLimit: { ipLong: "block" } });
    const state = await mocks.callAction();

    expect(state).toMatchObject({
      status: "global_error",
      fieldErrors: null,
      message: null,
    });
    expect(mocks.resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("TC9: email short 차단 시 global_error를 반환한다", async () => {
    const mocks = setupActionTest({ rateLimit: { emailShort: "block" } });
    const state = await mocks.callAction();

    expect(state).toMatchObject({
      status: "global_error",
      fieldErrors: null,
      message: null,
    });
    expect(mocks.resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("TC10: email long 차단 시 global_error를 반환한다", async () => {
    const mocks = setupActionTest({ rateLimit: { emailLong: "block" } });
    const state = await mocks.callAction();

    expect(state).toMatchObject({
      status: "global_error",
      fieldErrors: null,
      message: null,
    });
    expect(mocks.resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("TC11/TC12/TC13/TC13-1: allow 시 auth 공통 기준으로 eligibility를 1회 적용한다", async () => {
    const mocks = setupActionTest();
    await mocks.callAction();

    expect(mocks.checkRequestEligibilityMock).toHaveBeenCalledTimes(1);
    expect(mocks.checkRequestEligibilityMock).toHaveBeenCalledWith(
      "forgot-password",
      "203.0.113.10",
      "user@example.com",
    );
  });
});
