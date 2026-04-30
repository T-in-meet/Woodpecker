import { beforeEach, describe, expect, it, vi } from "vitest";

import { IP_SHORT_LIMIT } from "@/features/auth/lib/checkRequestEligibility";
import {
  emailStore,
  ipStore,
} from "@/features/auth/lib/requestEligibilityStore";

import {
  expectNoLegacyActionFields,
  setupActionTest,
} from "./utils/forgot-password-action-test-utils";

vi.mock("@/features/auth/lib/validateRedirectPath", () => ({
  validateRedirectPath: vi.fn(),
}));

function blockIpShort(ip = "203.0.113.10") {
  ipStore.set(ip, {
    shortWindow: {
      timestamps: Array.from({ length: IP_SHORT_LIMIT }, () => Date.now()),
    },
    longWindow: {
      timestamps: [],
    },
  });
}

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
        redirectTo: "https://example.com/api/auth/callback?type=recovery",
      }),
    );

    expect(state).toMatchObject({
      status: "success",
      fieldErrors: null,
    });

    expectNoLegacyActionFields(state);
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
    });

    expectNoLegacyActionFields(state);
  });

  it("TC3/TC4/TC5: invalid 입력이면 field_error를 반환한다", async () => {
    const mocks = setupActionTest({ email: "invalid-email" });
    const state = await mocks.callAction();

    expect(state).toMatchObject({
      status: "field_error",
      fieldErrors: { email: expect.any(Array) },
    });

    expectNoLegacyActionFields(state);

    expect(mocks.resetPasswordForEmailMock).not.toHaveBeenCalled();

    // checkRequestEligibilityMock 제거됨.
    // 대신 rate limit store가 변경되지 않았는지 검증.
    expect(ipStore.size).toBe(0);
    expect(emailStore.size).toBe(0);
  });

  it("TC14/TC15/TC16/TC37: redirect query를 callback URL로 보존 전달한다", async () => {
    const mocks = setupActionTest({ redirect: "/notes?tab=1" });
    await mocks.callAction();

    expect(mocks.resetPasswordForEmailMock).toHaveBeenCalledWith(
      "user@example.com",
      expect.objectContaining({
        redirectTo:
          "https://example.com/api/auth/callback?type=recovery&redirect=%2Fnotes%3Ftab%3D1",
      }),
    );
    expect(mocks.resetPasswordForEmailMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ redirectTo: "/notes?tab=1" }),
    );
  });

  it("TC17: forgot-password action에서는 validateRedirectPath를 호출하지 않고 redirect를 callback URL에 보존만 한다", async () => {
    const mocks = setupActionTest({
      redirect: "/notes?tab=1",
    });

    const mod = await import("@/features/auth/lib/validateRedirectPath");

    await mocks.callAction();

    expect(mod.validateRedirectPath).not.toHaveBeenCalled();
    expect(mocks.resetPasswordForEmailMock).toHaveBeenCalledWith(
      "user@example.com",
      expect.objectContaining({
        redirectTo:
          "https://example.com/api/auth/callback?type=recovery&redirect=%2Fnotes%3Ftab%3D1",
      }),
    );
  });

  it("TC18: Supabase 성공 시 success 상태를 반환한다", async () => {
    const mocks = setupActionTest({ supabase: "success" });
    const state = await mocks.callAction();
    expect(state).toMatchObject({
      status: "success",
      fieldErrors: null,
    });

    expectNoLegacyActionFields(state);
  });

  it("TC19: emailNotFoundError → success 유지", async () => {
    const mocks = setupActionTest({
      supabase: "emailNotFoundError",
    });

    const state = await mocks.callAction();

    expect(state.status).toBe("success");
    expect(mocks.resetPasswordForEmailMock).toHaveBeenCalled();
    expectNoLegacyActionFields(state);
  });

  it("TC20: general error → success 유지 + 내부 logging", async () => {
    const mocks = setupActionTest({
      supabase: "error",
    });

    const state = await mocks.callAction();

    expect(state.status).toBe("success");
    expect(
      mocks.logAuthEventMock.mock.calls.length +
        mocks.logAuthErrorMock.mock.calls.length,
    ).toBeGreaterThan(0);
    expectNoLegacyActionFields(state);
  });

  it("TC21: Supabase throw면 global_error 상태를 반환한다", async () => {
    const mocks = setupActionTest({ supabase: "throw" });
    const state = await mocks.callAction();
    expect(state).toMatchObject({
      status: "global_error",
      fieldErrors: null,
    });

    expectNoLegacyActionFields(state);
  });

  it("TC31: success 응답 state에는 redirect 관련 필드가 포함되지 않는다", async () => {
    const mocks = setupActionTest({
      redirect: "/notes",
      supabase: "success",
    });

    const state = await mocks.callAction();

    expect(state).not.toHaveProperty("redirect");
    expect(state).not.toHaveProperty("redirectTo");
    expectNoLegacyActionFields(state);
  });

  it("TC32: field_error 응답 state에는 redirect 관련 필드가 포함되지 않는다", async () => {
    const mocks = setupActionTest({
      redirect: "/notes",
      email: "invalid-email",
    });

    const state = await mocks.callAction();

    expect(state.status).toBe("field_error");
    expect(state).not.toHaveProperty("redirect");
    expect(state).not.toHaveProperty("redirectTo");
  });

  it("TC32-1: global_error 응답 state에는 redirect 관련 필드가 포함되지 않는다", async () => {
    const mocks = setupActionTest({
      redirect: "/notes",
      supabase: "throw",
    });

    const state = await mocks.callAction();

    expect(state.status).toBe("global_error");
    expect(state).not.toHaveProperty("redirect");
    expect(state).not.toHaveProperty("redirectTo");
    expectNoLegacyActionFields(state);
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

    const blocked = setupActionTest();
    blockIpShort();

    await blocked.callAction();

    expect(blocked.resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("TC35/TC36: 이메일 발송은 Supabase resetPasswordForEmail 호출만 검증한다", async () => {
    const mocks = setupActionTest();
    await mocks.callAction();
    expect(mocks.resetPasswordForEmailMock).toHaveBeenCalledTimes(1);
  });

  it("TC37: redirect query는 encode되어 전달된다", async () => {
    const mocks = setupActionTest({
      redirect: "/notes?tab=1",
    });

    await mocks.callAction();

    expect(mocks.resetPasswordForEmailMock).toHaveBeenCalledWith(
      "user@example.com",
      expect.objectContaining({
        redirectTo: expect.stringContaining("redirect=%2Fnotes%3Ftab%3D1"),
      }),
    );
  });
});
