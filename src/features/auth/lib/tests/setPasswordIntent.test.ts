/**
 * Set Password Intent 전용 단위 테스트.
 *
 * 검증 범위:
 * - signup-set-password purpose / userId / 15분 TTL 계약
 * - Set 전용 verifier의 user binding / expiration 경계
 * - raw cookie read 경계
 * - cookie create / clear lifecycle 및 보안 속성
 * - production / non-production Secure 차이
 * - create → read → verify integration seam
 * - create / verify configuration error propagation
 *
 * 공통 Signed Intent의 base64url / JSON / HMAC / timing-safe 비교 matrix는
 * passwordIntent.test.ts에서 이미 검증하므로 여기서 중복하지 않습니다.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieGetMock = vi.hoisted(() => vi.fn());
const cookieSetMock = vi.hoisted(() => vi.fn());
const cookiesMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { SET_PASSWORD_INTENT_TTL_SECONDS } from "../rate-limit/authRateLimitConstants";

const TEST_SECRET = "set-password-intent-test-secret";
const TEST_USER_ID = "user-123";
const OTHER_USER_ID = "user-456";
const NOW_SECONDS = 1_700_000_000;

type TestNodeEnv = "test" | "production";

/** NODE_ENV별 cookie options를 독립적으로 평가하도록 모듈 cache를 초기화합니다. */
async function loadSetPasswordIntent(nodeEnv: TestNodeEnv = "test") {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();

  return import("../setPasswordIntent");
}

/** createSetPasswordIntent()가 저장한 raw token을 반환합니다. */
function getStoredToken(): string {
  return cookieSetMock.mock.calls[0]?.[1] as string;
}

describe("setPasswordIntent", () => {
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

  it("Set Intent 생성/검증 시 signup-set-password purpose와 15분 TTL을 고정한다", async () => {
    const { createSetPasswordIntent, verifySetPasswordIntent } =
      await loadSetPasswordIntent();

    await createSetPasswordIntent({
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    const token = getStoredToken();

    expect(
      verifySetPasswordIntent({
        token,
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toEqual({
      purpose: "signup-set-password",
      userId: TEST_USER_ID,
      issuedAt: NOW_SECONDS,
      expiresAt: NOW_SECONDS + SET_PASSWORD_INTENT_TTL_SECONDS,
    });
  });

  it("다른 사용자의 Set Intent는 거부한다", async () => {
    const { createSetPasswordIntent, verifySetPasswordIntent } =
      await loadSetPasswordIntent();

    await createSetPasswordIntent({
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    const token = getStoredToken();

    expect(
      verifySetPasswordIntent({
        token,
        expectedUserId: OTHER_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
  });

  it("reset-password purpose token은 Set verifier에서 거부한다", async () => {
    const { verifySetPasswordIntent } = await loadSetPasswordIntent();
    const { createSignedPasswordIntent } = await import("../passwordIntent");

    const token = createSignedPasswordIntent({
      purpose: "reset-password",
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    expect(
      verifySetPasswordIntent({
        token,
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
  });

  it("expiresAt 시각부터 Set Intent를 만료로 거부한다", async () => {
    const { createSetPasswordIntent, verifySetPasswordIntent } =
      await loadSetPasswordIntent();

    await createSetPasswordIntent({
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    const token = getStoredToken();

    expect(
      verifySetPasswordIntent({
        token,
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS + SET_PASSWORD_INTENT_TTL_SECONDS,
      }),
    ).toBeNull();
  });

  it("cookie가 없으면 null, 있으면 raw token만 읽고 mutation하지 않는다", async () => {
    const { readSetPasswordIntent, SET_PASSWORD_INTENT_COOKIE } =
      await loadSetPasswordIntent();

    cookieGetMock.mockReturnValueOnce(undefined);

    await expect(readSetPasswordIntent()).resolves.toBeNull();
    expect(cookieGetMock).toHaveBeenNthCalledWith(
      1,
      SET_PASSWORD_INTENT_COOKIE,
    );
    expect(cookieSetMock).not.toHaveBeenCalled();

    cookieGetMock.mockReturnValueOnce({ value: "raw-intent-token" });

    await expect(readSetPasswordIntent()).resolves.toBe("raw-intent-token");
    expect(cookieGetMock).toHaveBeenNthCalledWith(
      2,
      SET_PASSWORD_INTENT_COOKIE,
    );
    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("non-production create는 Set cookie 계약과 15분 Max-Age를 적용한다", async () => {
    const {
      createSetPasswordIntent,
      SET_PASSWORD_INTENT_COOKIE,
      verifySetPasswordIntent,
    } = await loadSetPasswordIntent("test");

    expect(SET_PASSWORD_INTENT_COOKIE).toBe("set_password_intent");

    await createSetPasswordIntent({
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    expect(cookieSetMock).toHaveBeenCalledWith(
      "set_password_intent",
      expect.any(String),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/set-password",
        maxAge: SET_PASSWORD_INTENT_TTL_SECONDS,
      },
    );

    const token = getStoredToken();

    expect(
      verifySetPasswordIntent({
        token,
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).not.toBeNull();
  });

  it("production create는 Secure cookie를 사용한다", async () => {
    const { createSetPasswordIntent } =
      await loadSetPasswordIntent("production");

    await createSetPasswordIntent({
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    expect(cookieSetMock).toHaveBeenCalledWith(
      "set_password_intent",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        secure: true,
        path: "/set-password",
        maxAge: SET_PASSWORD_INTENT_TTL_SECONDS,
      }),
    );
  });

  it("clear는 create와 동일한 cookie identity로 Max-Age=0을 적용한다", async () => {
    const { clearSetPasswordIntent } = await loadSetPasswordIntent();

    await clearSetPasswordIntent();

    expect(cookieSetMock).toHaveBeenCalledWith("set_password_intent", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/set-password",
      maxAge: 0,
    });
  });

  it("create → read → verify round-trip이 동일 Set Intent 경계를 유지한다", async () => {
    const {
      createSetPasswordIntent,
      readSetPasswordIntent,
      verifySetPasswordIntent,
    } = await loadSetPasswordIntent();

    await createSetPasswordIntent({
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    const storedToken = getStoredToken();
    cookieGetMock.mockReturnValue({ value: storedToken });

    const rawToken = await readSetPasswordIntent();

    expect(rawToken).toBe(storedToken);
    expect(
      verifySetPasswordIntent({
        token: rawToken as string,
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toEqual({
      purpose: "signup-set-password",
      userId: TEST_USER_ID,
      issuedAt: NOW_SECONDS,
      expiresAt: NOW_SECONDS + SET_PASSWORD_INTENT_TTL_SECONDS,
    });
  });

  it("create 시 signing secret configuration error를 Set lifecycle에서 숨기지 않는다", async () => {
    const { createSetPasswordIntent } = await loadSetPasswordIntent();
    vi.stubEnv("PASSWORD_INTENT_SIGNING_SECRET", "");

    await expect(
      createSetPasswordIntent({
        userId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).rejects.toThrow("PASSWORD_INTENT_SIGNING_SECRET is not configured");

    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("verify 시 signing secret configuration error를 null로 숨기지 않는다", async () => {
    const { createSetPasswordIntent, verifySetPasswordIntent } =
      await loadSetPasswordIntent();

    await createSetPasswordIntent({
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    const token = getStoredToken();
    vi.stubEnv("PASSWORD_INTENT_SIGNING_SECRET", "");

    expect(() =>
      verifySetPasswordIntent({
        token,
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toThrow("PASSWORD_INTENT_SIGNING_SECRET is not configured");
  });
});
