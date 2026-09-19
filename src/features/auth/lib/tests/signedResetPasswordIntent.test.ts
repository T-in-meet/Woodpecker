/**
 * signed Reset Password Intent 전용 단위 테스트.
 *
 * 검증 범위:
 * - reset-password purpose / userId / 15분 TTL 계약
 * - Reset 전용 verifier의 purpose / user binding / expiration 경계
 * - legacy fixed-value `verified` rejection
 * - raw cookie read 경계
 * - cookie create / clear lifecycle 및 보안 속성
 * - production / non-production Secure 차이
 * - create → read → verify integration seam
 * - create / verify configuration error propagation
 *
 * 공통 Signed Intent의 base64url / JSON / HMAC / timing-safe 비교 matrix는
 * signedIntent.test.ts에서 이미 검증하므로 여기서 중복하지 않습니다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieGetMock = vi.hoisted(() => vi.fn());
const cookieSetMock = vi.hoisted(() => vi.fn());
const cookiesMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { RESET_PASSWORD_INTENT_TTL_SECONDS } from "../rate-limit/authRateLimitConstants";

const TEST_SECRET = "reset-password-intent-test-secret";
const TEST_USER_ID = "user-123";
const OTHER_USER_ID = "user-456";
const NOW_SECONDS = 1_700_000_000;

type TestNodeEnv = "test" | "production";

/** NODE_ENV별 cookie options를 독립적으로 평가하도록 모듈 cache를 초기화합니다. */
async function loadSignedResetPasswordIntent(nodeEnv: TestNodeEnv = "test") {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();

  return import("../signedResetPasswordIntent");
}

/** createSignedResetPasswordIntent()가 저장한 raw token을 반환합니다. */
function getStoredToken(): string {
  return cookieSetMock.mock.calls[0]?.[1] as string;
}

describe("signedResetPasswordIntent", () => {
  beforeEach(() => {
    vi.stubEnv("PASSWORD_INTENT_SIGNING_SECRET", TEST_SECRET);

    cookieGetMock.mockReset();
    cookieSetMock.mockReset();
    cookiesMock.mockReset();
    cookiesMock.mockResolvedValue({
      get: cookieGetMock,
      set: cookieSetMock,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("Reset Intent 생성/검증 시 reset-password purpose와 15분 TTL을 고정한다", async () => {
    const { createSignedResetPasswordIntent, verifyResetPasswordIntent } =
      await loadSignedResetPasswordIntent();

    await createSignedResetPasswordIntent({
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    const token = getStoredToken();

    expect(
      verifyResetPasswordIntent({
        token,
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toEqual({
      purpose: "reset-password",
      userId: TEST_USER_ID,
      issuedAt: NOW_SECONDS,
      expiresAt: NOW_SECONDS + RESET_PASSWORD_INTENT_TTL_SECONDS,
    });
  });

  it("다른 사용자의 Reset Intent는 거부한다", async () => {
    const { createSignedResetPasswordIntent, verifyResetPasswordIntent } =
      await loadSignedResetPasswordIntent();

    await createSignedResetPasswordIntent({
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    const token = getStoredToken();

    expect(
      verifyResetPasswordIntent({
        token,
        expectedUserId: OTHER_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
  });

  it("signup-set-password purpose token은 Reset verifier에서 거부한다", async () => {
    const { verifyResetPasswordIntent } = await loadSignedResetPasswordIntent();
    const { createSignedIntent } = await import("../signedIntent");

    const token = createSignedIntent({
      purpose: "signup-set-password",
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    expect(
      verifyResetPasswordIntent({
        token,
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
  });

  it("legacy fixed-value verified는 signed Reset Intent로 인정하지 않는다", async () => {
    const { verifyResetPasswordIntent } = await loadSignedResetPasswordIntent();

    expect(
      verifyResetPasswordIntent({
        token: "verified",
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
  });

  it("expiresAt 시각부터 Reset Intent를 만료로 거부한다", async () => {
    const { createSignedResetPasswordIntent, verifyResetPasswordIntent } =
      await loadSignedResetPasswordIntent();

    await createSignedResetPasswordIntent({
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    const token = getStoredToken();

    expect(
      verifyResetPasswordIntent({
        token,
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS + RESET_PASSWORD_INTENT_TTL_SECONDS,
      }),
    ).toBeNull();
  });

  it("cookie가 없으면 null, 있으면 raw token만 읽고 mutation하지 않는다", async () => {
    const {
      readSignedResetPasswordIntent,
      SIGNED_RESET_PASSWORD_INTENT_COOKIE,
    } = await loadSignedResetPasswordIntent();

    cookieGetMock.mockReturnValueOnce(undefined);

    await expect(readSignedResetPasswordIntent()).resolves.toBeNull();
    expect(cookieGetMock).toHaveBeenNthCalledWith(
      1,
      SIGNED_RESET_PASSWORD_INTENT_COOKIE,
    );
    expect(cookieSetMock).not.toHaveBeenCalled();

    cookieGetMock.mockReturnValueOnce({ value: "raw-intent-token" });

    await expect(readSignedResetPasswordIntent()).resolves.toBe(
      "raw-intent-token",
    );
    expect(cookieGetMock).toHaveBeenNthCalledWith(
      2,
      SIGNED_RESET_PASSWORD_INTENT_COOKIE,
    );
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("non-production create는 Reset cookie 계약과 15분 Max-Age를 적용한다", async () => {
    const {
      createSignedResetPasswordIntent,
      SIGNED_RESET_PASSWORD_INTENT_COOKIE,
      verifyResetPasswordIntent,
    } = await loadSignedResetPasswordIntent("test");

    expect(SIGNED_RESET_PASSWORD_INTENT_COOKIE).toBe("reset_password_intent");

    await createSignedResetPasswordIntent({
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    expect(cookieSetMock).toHaveBeenCalledWith(
      "reset_password_intent",
      expect.any(String),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/reset-password",
        maxAge: RESET_PASSWORD_INTENT_TTL_SECONDS,
      },
    );

    const token = getStoredToken();

    expect(
      verifyResetPasswordIntent({
        token,
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).not.toBeNull();
  });

  it("production create는 Secure cookie를 사용한다", async () => {
    const { createSignedResetPasswordIntent } =
      await loadSignedResetPasswordIntent("production");

    await createSignedResetPasswordIntent({
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    expect(cookieSetMock).toHaveBeenCalledWith(
      "reset_password_intent",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/reset-password",
        maxAge: RESET_PASSWORD_INTENT_TTL_SECONDS,
      }),
    );
  });

  it("clear는 create와 동일한 cookie identity로 Max-Age=0을 적용한다", async () => {
    const { clearSignedResetPasswordIntent } =
      await loadSignedResetPasswordIntent();

    await clearSignedResetPasswordIntent();

    expect(cookieSetMock).toHaveBeenCalledWith("reset_password_intent", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/reset-password",
      maxAge: 0,
    });
  });

  it("create → read → verify round-trip이 동일 Reset Intent 경계를 유지한다", async () => {
    const {
      createSignedResetPasswordIntent,
      readSignedResetPasswordIntent,
      verifyResetPasswordIntent,
    } = await loadSignedResetPasswordIntent();

    await createSignedResetPasswordIntent({
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    const storedToken = getStoredToken();
    cookieGetMock.mockReturnValue({ value: storedToken });

    const rawToken = await readSignedResetPasswordIntent();

    expect(rawToken).toBe(storedToken);
    expect(
      verifyResetPasswordIntent({
        token: rawToken as string,
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toEqual({
      purpose: "reset-password",
      userId: TEST_USER_ID,
      issuedAt: NOW_SECONDS,
      expiresAt: NOW_SECONDS + RESET_PASSWORD_INTENT_TTL_SECONDS,
    });
  });

  it("create 시 signing secret configuration error를 Reset lifecycle에서 숨기지 않는다", async () => {
    const { createSignedResetPasswordIntent } =
      await loadSignedResetPasswordIntent();
    vi.stubEnv("PASSWORD_INTENT_SIGNING_SECRET", "");

    await expect(
      createSignedResetPasswordIntent({
        userId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).rejects.toThrow("PASSWORD_INTENT_SIGNING_SECRET is not configured");

    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("verify 시 signing secret configuration error를 null로 숨기지 않는다", async () => {
    const { createSignedResetPasswordIntent, verifyResetPasswordIntent } =
      await loadSignedResetPasswordIntent();

    await createSignedResetPasswordIntent({
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    const token = getStoredToken();
    vi.stubEnv("PASSWORD_INTENT_SIGNING_SECRET", "");

    expect(() =>
      verifyResetPasswordIntent({
        token,
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toThrow("PASSWORD_INTENT_SIGNING_SECRET is not configured");
  });
});
