/**
 * Set Password Intent 전용 단위 테스트.
 *
 * 검증 범위:
 * - signup-set-password exact 5-claim / signed redirectPath
 * - redirect wrapper 재검증 및 MYPAGE fallback
 * - final token UTF-8 byte-size budget
 * - user binding / expiration
 * - raw cookie read / create / clear lifecycle
 * - production / non-production Secure 차이
 * - configuration error fail-closed
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieGetMock = vi.hoisted(() => vi.fn());
const cookieSetMock = vi.hoisted(() => vi.fn());
const cookiesMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

import { ROUTES } from "@/lib/constants/routes";

import { SET_PASSWORD_INTENT_TTL_SECONDS } from "../rate-limit/authRateLimitConstants";

const TEST_SECRET = "set-password-intent-test-secret";
const TEST_USER_ID = "user-123";
const OTHER_USER_ID = "user-456";
const TEST_REDIRECT_PATH = "/notes";
const NOW_SECONDS = 1_700_000_000;

type TestNodeEnv = "test" | "production";

async function loadSetPasswordIntent(nodeEnv: TestNodeEnv = "test") {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.resetModules();

  return import("../setPasswordIntent");
}

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

  it("Set Intent 생성/검증 시 signed redirectPath와 15분 TTL을 고정한다", async () => {
    const { createSetPasswordIntent, verifySetPasswordIntent } =
      await loadSetPasswordIntent();

    await createSetPasswordIntent({
      userId: TEST_USER_ID,
      redirectPath: TEST_REDIRECT_PATH,
      nowSeconds: NOW_SECONDS,
    });

    expect(
      verifySetPasswordIntent({
        token: getStoredToken(),
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toEqual({
      purpose: "signup-set-password",
      userId: TEST_USER_ID,
      issuedAt: NOW_SECONDS,
      expiresAt: NOW_SECONDS + SET_PASSWORD_INTENT_TTL_SECONDS,
      redirectPath: TEST_REDIRECT_PATH,
    });
  });

  it.each([
    ["redirect 없음", undefined],
    ["빈 redirect", ""],
    ["외부 URL", "https://evil.example"],
    ["차단된 auth path", "/login"],
  ])(
    "%s이면 MYPAGE를 signed destination으로 사용한다",
    async (_name, redirectPath) => {
      const { createSetPasswordIntent, verifySetPasswordIntent } =
        await loadSetPasswordIntent();

      await createSetPasswordIntent({
        userId: TEST_USER_ID,
        redirectPath,
        nowSeconds: NOW_SECONDS,
      });

      expect(
        verifySetPasswordIntent({
          token: getStoredToken(),
          expectedUserId: TEST_USER_ID,
          nowSeconds: NOW_SECONDS,
        }),
      ).toEqual(
        expect.objectContaining({
          redirectPath: ROUTES.MYPAGE,
        }),
      );
    },
  );

  it("허용된 query가 있는 redirect를 정규화해 signed claim으로 보존한다", async () => {
    const { createSetPasswordIntent, verifySetPasswordIntent } =
      await loadSetPasswordIntent();

    await createSetPasswordIntent({
      userId: TEST_USER_ID,
      redirectPath: "/mypage?section=profile",
      nowSeconds: NOW_SECONDS,
    });

    expect(
      verifySetPasswordIntent({
        token: getStoredToken(),
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toEqual(
      expect.objectContaining({
        redirectPath: "/mypage?section=profile",
      }),
    );
  });

  it("다른 사용자의 Set Intent는 거부한다", async () => {
    const { createSetPasswordIntent, verifySetPasswordIntent } =
      await loadSetPasswordIntent();

    await createSetPasswordIntent({
      userId: TEST_USER_ID,
      redirectPath: TEST_REDIRECT_PATH,
      nowSeconds: NOW_SECONDS,
    });

    expect(
      verifySetPasswordIntent({
        token: getStoredToken(),
        expectedUserId: OTHER_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
  });

  it("reset-password purpose token은 Set verifier에서 거부한다", async () => {
    const { verifySetPasswordIntent } = await loadSetPasswordIntent();
    const { createSignedIntent } = await import("../signedIntent");

    const token = createSignedIntent({
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
      redirectPath: TEST_REDIRECT_PATH,
      nowSeconds: NOW_SECONDS,
    });

    expect(
      verifySetPasswordIntent({
        token: getStoredToken(),
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

  it("non-production create는 Set cookie identity와 TTL을 적용한다", async () => {
    const {
      createSetPasswordIntent,
      SET_PASSWORD_INTENT_COOKIE,
      verifySetPasswordIntent,
    } = await loadSetPasswordIntent("test");

    expect(SET_PASSWORD_INTENT_COOKIE).toBe("set_password_intent");

    await createSetPasswordIntent({
      userId: TEST_USER_ID,
      redirectPath: TEST_REDIRECT_PATH,
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

    expect(
      verifySetPasswordIntent({
        token: getStoredToken(),
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
      redirectPath: TEST_REDIRECT_PATH,
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

  it("create → read → verify round-trip에서 signed destination을 유지한다", async () => {
    const {
      createSetPasswordIntent,
      readSetPasswordIntent,
      verifySetPasswordIntent,
    } = await loadSetPasswordIntent();

    await createSetPasswordIntent({
      userId: TEST_USER_ID,
      redirectPath: TEST_REDIRECT_PATH,
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
      redirectPath: TEST_REDIRECT_PATH,
    });
  });

  it("최종 token byte budget을 넘는 redirect는 signed MYPAGE token으로 fallback한다", async () => {
    const {
      createSetPasswordIntent,
      SET_PASSWORD_INTENT_MAX_TOKEN_BYTES,
      verifySetPasswordIntent,
    } = await loadSetPasswordIntent();

    const oversizedAfterNormalization = `/notes?q=${"가".repeat(1_000)}`;

    await createSetPasswordIntent({
      userId: TEST_USER_ID,
      redirectPath: oversizedAfterNormalization,
      nowSeconds: NOW_SECONDS,
    });

    const token = getStoredToken();

    expect(Buffer.byteLength(token, "utf8")).toBeLessThanOrEqual(
      SET_PASSWORD_INTENT_MAX_TOKEN_BYTES,
    );
    expect(
      verifySetPasswordIntent({
        token,
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toEqual(
      expect.objectContaining({
        redirectPath: ROUTES.MYPAGE,
      }),
    );
  });

  it("MYPAGE fallback token도 byte budget을 넘으면 cookie를 쓰지 않고 system error로 실패한다", async () => {
    const { createSetPasswordIntent, SET_PASSWORD_INTENT_MAX_TOKEN_BYTES } =
      await loadSetPasswordIntent();

    const oversizedUserId = "u".repeat(SET_PASSWORD_INTENT_MAX_TOKEN_BYTES * 2);

    await expect(
      createSetPasswordIntent({
        userId: oversizedUserId,
        redirectPath: ROUTES.MYPAGE,
        nowSeconds: NOW_SECONDS,
      }),
    ).rejects.toThrow(
      "Set Password Intent exceeds the cookie-safe size budget",
    );

    expect(cookieSetMock).not.toHaveBeenCalled();
  });

  it("create 시 signing secret configuration error를 숨기지 않는다", async () => {
    const { createSetPasswordIntent } = await loadSetPasswordIntent();
    vi.stubEnv("PASSWORD_INTENT_SIGNING_SECRET", "");

    await expect(
      createSetPasswordIntent({
        userId: TEST_USER_ID,
        redirectPath: TEST_REDIRECT_PATH,
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
      redirectPath: TEST_REDIRECT_PATH,
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
