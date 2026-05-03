import { describe, expect, it } from "vitest";

import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";
import {
  EMAIL_LONG_LIMIT,
  EMAIL_SHORT_LIMIT,
  IP_LONG_LIMIT,
  IP_SHORT_LIMIT,
} from "@/features/auth/lib/checkRequestEligibility";
import {
  emailStore,
  ipStore,
} from "@/features/auth/lib/requestEligibilityStore";

import {
  expectNoLegacyActionFields,
  setupActionTest,
} from "./utils/forgot-password-action-test-utils";

const TEST_IP = "203.0.113.10";
const CANONICAL_EMAIL = "user@example.com";
const FORGOT_PASSWORD_EMAIL_KEY = `forgotPassword:${CANONICAL_EMAIL}`;

function timestamps(count: number) {
  const now = Date.now();
  return Array.from({ length: count }, () => now);
}

function blockIpShort(ip = TEST_IP) {
  ipStore.set(ip, {
    shortWindow: { timestamps: timestamps(IP_SHORT_LIMIT) },
    longWindow: { timestamps: [] },
  });
}

function blockIpLong(ip = TEST_IP) {
  ipStore.set(ip, {
    shortWindow: { timestamps: [] },
    longWindow: { timestamps: timestamps(IP_LONG_LIMIT) },
  });
}

function blockEmailShort(emailKey = FORGOT_PASSWORD_EMAIL_KEY) {
  emailStore.set(emailKey, {
    shortWindow: { timestamps: timestamps(EMAIL_SHORT_LIMIT) },
    longWindow: { timestamps: [] },
  });
}

function blockEmailLong(emailKey = FORGOT_PASSWORD_EMAIL_KEY) {
  emailStore.set(emailKey, {
    shortWindow: null,
    longWindow: { timestamps: timestamps(EMAIL_LONG_LIMIT) },
  });
}

function expectRateLimitedLog(
  mocks: ReturnType<typeof setupActionTest>,
  reasonCode: string,
) {
  expect(mocks.logAuthEventMock).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({
      status: 429,
      result: "blocked",
      reasonCode,
    }),
  );
}

describe("forgotPasswordAction - rate limit", () => {
  it("TC6: 유효한 email이면 canonicalEmail 기준 forgot-password 전용 email bucket key를 생성한다", async () => {
    const mocks = setupActionTest({ email: "User@Example.COM" });

    await mocks.callAction();

    expect(emailStore.has(FORGOT_PASSWORD_EMAIL_KEY)).toBe(true);
    expect(emailStore.has("User@Example.COM")).toBe(false);
    expect(emailStore.has(CANONICAL_EMAIL)).toBe(false);
  });

  it("TC7: IP short 차단 시 blocked를 반환하고 generateLink를 호출하지 않는다", async () => {
    const mocks = setupActionTest();
    blockIpShort();

    const state = await mocks.callAction();

    expect(state).toMatchObject({
      status: "blocked",
      fieldErrors: null,
    });
    expectNoLegacyActionFields(state);
    expect(mocks.generateLinkMock).not.toHaveBeenCalled();
    expectRateLimitedLog(mocks, AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT);
  });

  it("TC8: IP long 차단 시 blocked를 반환하고 generateLink를 호출하지 않는다", async () => {
    const mocks = setupActionTest();
    blockIpLong();

    const state = await mocks.callAction();

    expect(state).toMatchObject({
      status: "blocked",
      fieldErrors: null,
    });
    expectNoLegacyActionFields(state);
    expect(mocks.generateLinkMock).not.toHaveBeenCalled();
    expectRateLimitedLog(mocks, AUTH_LOG_REASONS.RATE_LIMIT_IP_LONG);
  });

  it("TC9: email short 차단 시 blocked를 반환하고 generateLink를 호출하지 않는다", async () => {
    const mocks = setupActionTest();
    blockEmailShort();

    const state = await mocks.callAction();

    expect(state).toMatchObject({
      status: "blocked",
      fieldErrors: null,
    });
    expectNoLegacyActionFields(state);
    expect(mocks.generateLinkMock).not.toHaveBeenCalled();
    expectRateLimitedLog(mocks, AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT);
  });

  it("TC10: email long 차단 시 blocked를 반환하고 generateLink를 호출하지 않는다", async () => {
    const mocks = setupActionTest();
    blockEmailLong();

    const state = await mocks.callAction();

    expect(state).toMatchObject({
      status: "blocked",
      fieldErrors: null,
    });
    expectNoLegacyActionFields(state);
    expect(mocks.generateLinkMock).not.toHaveBeenCalled();
    expectRateLimitedLog(mocks, AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG);
  });

  it("TC11: allow 시 IP short / IP long / email short / email long을 모두 업데이트한다", async () => {
    const mocks = setupActionTest();

    await mocks.callAction();

    expect(ipStore.get(TEST_IP)?.shortWindow?.timestamps).toHaveLength(1);
    expect(ipStore.get(TEST_IP)?.longWindow?.timestamps).toHaveLength(1);

    const emailEntry = emailStore.get(FORGOT_PASSWORD_EMAIL_KEY);
    expect(emailEntry?.shortWindow?.timestamps).toHaveLength(1);
    expect(emailEntry?.longWindow?.timestamps).toHaveLength(1);
  });

  it("TC12: IP bucket은 forgot-password 전용 key가 아니라 auth 공통 IP key를 사용한다", async () => {
    const mocks = setupActionTest();

    await mocks.callAction();

    expect(ipStore.has(TEST_IP)).toBe(true);
    expect(ipStore.has(`forgotPassword:${TEST_IP}`)).toBe(false);
  });

  it("TC13: forgot-password email bucket은 login/signup과 분리된 전용 key를 사용한다", async () => {
    const mocks = setupActionTest();

    await mocks.callAction();

    expect(emailStore.has(FORGOT_PASSWORD_EMAIL_KEY)).toBe(true);
    expect(emailStore.has(CANONICAL_EMAIL)).toBe(false);
  });

  it("TC13-1: IP rate limit key는 auth 공통 기준을 따른다", async () => {
    const mocks = setupActionTest();

    await mocks.callAction();

    expect([...ipStore.keys()]).toEqual([TEST_IP]);
  });
});
