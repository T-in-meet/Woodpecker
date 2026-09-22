/**
 * Signed Intent 단위 테스트.
 *
 * 검증 범위:
 * - Set Password exact 5-claim / Reset Password exact 4-claim
 * - purpose-aware sign → verify 정상 round-trip
 * - strict base64url / JSON / exact payload schema
 * - purpose / userId authorization binding
 * - redirectPath tamper 검출
 * - issuedAt / expiresAt / TTL / expiration 경계
 * - signing secret 누락 시 fail-closed
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";

vi.mock("server-only", () => ({}));

import {
  RESET_PASSWORD_INTENT_TTL_SECONDS,
  SET_PASSWORD_INTENT_TTL_SECONDS,
} from "../rate-limit/authRateLimitConstants";
import {
  createSignedIntent,
  type ResetPasswordIntentPayload,
  type SetPasswordIntentPayload,
  verifySignedIntent,
} from "../signedIntent";

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();

  return {
    ...actual,
    timingSafeEqual: vi.fn(actual.timingSafeEqual),
  };
});

const TEST_SECRET = "password-intent-test-secret";
const TEST_USER_ID = "user-123";
const OTHER_USER_ID = "user-456";
const TEST_REDIRECT_PATH = "/notes";
const NOW_SECONDS = 1_700_000_000;

function encodePayload(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function signPayloadPart(payloadPart: string): string {
  const signaturePart = createHmac("sha256", TEST_SECRET)
    .update(payloadPart, "utf8")
    .digest("base64url");

  return `${payloadPart}.${signaturePart}`;
}

function createTokenForPayload(payload: unknown): string {
  return signPayloadPart(encodePayload(payload));
}

function createValidSetPayload(
  overrides: Partial<SetPasswordIntentPayload> = {},
): SetPasswordIntentPayload {
  return {
    purpose: "signup-set-password",
    userId: TEST_USER_ID,
    issuedAt: NOW_SECONDS,
    expiresAt: NOW_SECONDS + SET_PASSWORD_INTENT_TTL_SECONDS,
    redirectPath: TEST_REDIRECT_PATH,
    ...overrides,
  };
}

describe("signedIntent", () => {
  beforeEach(() => {
    vi.stubEnv("PASSWORD_INTENT_SIGNING_SECRET", TEST_SECRET);
    vi.mocked(timingSafeEqual).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("Set Password Intent는 exact 5-claim payload로 sign/verify된다", () => {
    const token = createSignedIntent({
      purpose: "signup-set-password",
      userId: TEST_USER_ID,
      redirectPath: TEST_REDIRECT_PATH,
      nowSeconds: NOW_SECONDS,
    });

    expect(
      verifySignedIntent({
        token,
        expectedPurpose: "signup-set-password",
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

  it("Reset Password Intent는 기존 exact 4-claim payload를 유지한다", () => {
    const token = createSignedIntent({
      purpose: "reset-password",
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    expect(
      verifySignedIntent({
        token,
        expectedPurpose: "reset-password",
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

  it("expectedPurpose literal에 따라 verifier 반환 타입이 purpose-aware하게 좁혀진다", () => {
    const setToken = createSignedIntent({
      purpose: "signup-set-password",
      userId: TEST_USER_ID,
      redirectPath: TEST_REDIRECT_PATH,
      nowSeconds: NOW_SECONDS,
    });
    const resetToken = createSignedIntent({
      purpose: "reset-password",
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    const setResult = verifySignedIntent({
      token: setToken,
      expectedPurpose: "signup-set-password",
      expectedUserId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });
    const resetResult = verifySignedIntent({
      token: resetToken,
      expectedPurpose: "reset-password",
      expectedUserId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    expectTypeOf(setResult).toEqualTypeOf<SetPasswordIntentPayload | null>();
    expectTypeOf(
      resetResult,
    ).toEqualTypeOf<ResetPasswordIntentPayload | null>();
  });

  it.each(["", "   "])("signer는 빈/공백 userId(%j)를 거부한다", (userId) => {
    expect(() =>
      createSignedIntent({
        purpose: "signup-set-password",
        userId,
        redirectPath: TEST_REDIRECT_PATH,
        nowSeconds: NOW_SECONDS,
      }),
    ).toThrow("Password Intent userId is required");
  });

  it.each(["", "   "])(
    "Set signer는 빈/공백 redirectPath(%j)를 거부한다",
    (redirectPath) => {
      expect(() =>
        createSignedIntent({
          purpose: "signup-set-password",
          userId: TEST_USER_ID,
          redirectPath,
          nowSeconds: NOW_SECONDS,
        }),
      ).toThrow("Set Password Intent redirectPath is required");
    },
  );

  it.each([-1, NOW_SECONDS + 0.5])(
    "signer는 잘못된 nowSeconds(%s)를 거부한다",
    (nowSeconds) => {
      expect(() =>
        createSignedIntent({
          purpose: "signup-set-password",
          userId: TEST_USER_ID,
          redirectPath: TEST_REDIRECT_PATH,
          nowSeconds,
        }),
      ).toThrow("Password Intent nowSeconds must be a non-negative integer");
    },
  );

  it("Set token을 Reset purpose로 재사용할 수 없다", () => {
    const token = createSignedIntent({
      purpose: "signup-set-password",
      userId: TEST_USER_ID,
      redirectPath: TEST_REDIRECT_PATH,
      nowSeconds: NOW_SECONDS,
    });

    expect(
      verifySignedIntent({
        token,
        expectedPurpose: "reset-password",
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
  });

  it("Reset token을 Set purpose로 재사용할 수 없다", () => {
    const token = createSignedIntent({
      purpose: "reset-password",
      userId: TEST_USER_ID,
      nowSeconds: NOW_SECONDS,
    });

    expect(
      verifySignedIntent({
        token,
        expectedPurpose: "signup-set-password",
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
  });

  it("expected userId가 다르면 같은 purpose token도 거부한다", () => {
    const token = createSignedIntent({
      purpose: "signup-set-password",
      userId: TEST_USER_ID,
      redirectPath: TEST_REDIRECT_PATH,
      nowSeconds: NOW_SECONDS,
    });

    expect(
      verifySignedIntent({
        token,
        expectedPurpose: "signup-set-password",
        expectedUserId: OTHER_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
  });

  it.each(["", "payload-only", "a.b.c", ".signature", "payload."])(
    "2-part 구조가 아닌 token(%s)은 거부한다",
    (token) => {
      expect(
        verifySignedIntent({
          token,
          expectedPurpose: "signup-set-password",
          expectedUserId: TEST_USER_ID,
          nowSeconds: NOW_SECONDS,
        }),
      ).toBeNull();
    },
  );

  it("signature가 malformed base64url이면 거부한다", () => {
    const payloadPart = encodePayload(createValidSetPayload());

    expect(
      verifySignedIntent({
        token: `${payloadPart}.***`,
        expectedPurpose: "signup-set-password",
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
  });

  it.each([31, 33])(
    "signature digest 길이가 SHA-256 길이와 다른 %s byte이면 timingSafeEqual 전에 거부한다",
    (signatureBytes) => {
      const payloadPart = encodePayload(createValidSetPayload());
      const invalidLengthSignature =
        Buffer.alloc(signatureBytes).toString("base64url");

      expect(
        verifySignedIntent({
          token: `${payloadPart}.${invalidLengthSignature}`,
          expectedPurpose: "signup-set-password",
          expectedUserId: TEST_USER_ID,
          nowSeconds: NOW_SECONDS,
        }),
      ).toBeNull();
      expect(timingSafeEqual).not.toHaveBeenCalled();
    },
  );

  it("같은 길이의 잘못된 signature는 timingSafeEqual 비교 후 거부한다", () => {
    const payloadPart = encodePayload(createValidSetPayload());
    const wrongSignature = Buffer.alloc(32, 1).toString("base64url");

    expect(
      verifySignedIntent({
        token: `${payloadPart}.${wrongSignature}`,
        expectedPurpose: "signup-set-password",
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
    expect(timingSafeEqual).toHaveBeenCalledTimes(1);
  });

  it("signature는 유효하지만 payloadPart가 malformed base64url이면 거부한다", () => {
    const token = signPayloadPart("***");

    expect(
      verifySignedIntent({
        token,
        expectedPurpose: "signup-set-password",
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
  });

  it("signature는 유효하지만 payload JSON이 malformed이면 거부한다", () => {
    const payloadPart = Buffer.from("not-json", "utf8").toString("base64url");
    const token = signPayloadPart(payloadPart);

    expect(
      verifySignedIntent({
        token,
        expectedPurpose: "signup-set-password",
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
  });

  it.each([
    ["null payload", null],
    ["array payload", []],
    [
      "Set redirectPath 누락",
      {
        purpose: "signup-set-password",
        userId: TEST_USER_ID,
        issuedAt: NOW_SECONDS,
        expiresAt: NOW_SECONDS + SET_PASSWORD_INTENT_TTL_SECONDS,
      },
    ],
    ["Set 추가 필드", { ...createValidSetPayload(), extra: true }],
    [
      "unsupported purpose",
      { ...createValidSetPayload(), purpose: "unsupported-purpose" },
    ],
    ["non-string userId", { ...createValidSetPayload(), userId: 123 }],
    ["빈 userId", createValidSetPayload({ userId: "" })],
    ["빈 redirectPath", createValidSetPayload({ redirectPath: "" })],
    ["음수 issuedAt", createValidSetPayload({ issuedAt: -1 })],
    ["소수 issuedAt", createValidSetPayload({ issuedAt: NOW_SECONDS + 0.5 })],
    ["음수 expiresAt", createValidSetPayload({ expiresAt: -1 })],
    ["소수 expiresAt", createValidSetPayload({ expiresAt: NOW_SECONDS + 1.5 })],
  ])("잘못된 Set payload schema(%s)는 거부한다", (_name, payload) => {
    const token = createTokenForPayload(payload);

    expect(
      verifySignedIntent({
        token,
        expectedPurpose: "signup-set-password",
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
  });

  it("Reset payload에 redirectPath가 추가되면 exact 4-claim schema에서 거부한다", () => {
    const token = createTokenForPayload({
      purpose: "reset-password",
      userId: TEST_USER_ID,
      issuedAt: NOW_SECONDS,
      expiresAt: NOW_SECONDS + RESET_PASSWORD_INTENT_TTL_SECONDS,
      redirectPath: TEST_REDIRECT_PATH,
    });

    expect(
      verifySignedIntent({
        token,
        expectedPurpose: "reset-password",
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
  });

  it("redirectPath를 변조하고 기존 signature를 재사용하면 거부한다", () => {
    const token = createSignedIntent({
      purpose: "signup-set-password",
      userId: TEST_USER_ID,
      redirectPath: TEST_REDIRECT_PATH,
      nowSeconds: NOW_SECONDS,
    });
    const [payloadPart, signaturePart] = token.split(".");
    const payload = JSON.parse(
      Buffer.from(payloadPart!, "base64url").toString("utf8"),
    ) as SetPasswordIntentPayload;
    const tamperedPayloadPart = encodePayload({
      ...payload,
      redirectPath: "/mypage",
    });

    expect(
      verifySignedIntent({
        token: `${tamperedPayloadPart}.${signaturePart}`,
        expectedPurpose: "signup-set-password",
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
  });

  it.each([
    [
      "future issuedAt",
      createValidSetPayload({
        issuedAt: NOW_SECONDS + 1,
        expiresAt: NOW_SECONDS + 1 + SET_PASSWORD_INTENT_TTL_SECONDS,
      }),
    ],
    [
      "expiresAt === issuedAt",
      createValidSetPayload({ expiresAt: NOW_SECONDS }),
    ],
    [
      "TTL 초과",
      createValidSetPayload({
        expiresAt: NOW_SECONDS + SET_PASSWORD_INTENT_TTL_SECONDS + 1,
      }),
    ],
    [
      "exact expiration",
      createValidSetPayload({
        issuedAt: NOW_SECONDS - SET_PASSWORD_INTENT_TTL_SECONDS,
        expiresAt: NOW_SECONDS,
      }),
    ],
  ])("시간 계약 위반(%s)은 거부한다", (_name, payload) => {
    const token = createTokenForPayload(payload);

    expect(
      verifySignedIntent({
        token,
        expectedPurpose: "signup-set-password",
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toBeNull();
  });

  it("만료 1초 전(now === expiresAt - 1)에는 유효하다", () => {
    const expiresAt = NOW_SECONDS + 1;
    const payload = createValidSetPayload({
      issuedAt: expiresAt - SET_PASSWORD_INTENT_TTL_SECONDS,
      expiresAt,
    });
    const token = createTokenForPayload(payload);

    expect(
      verifySignedIntent({
        token,
        expectedPurpose: "signup-set-password",
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toEqual(payload);
  });

  it("signing secret이 없으면 signer는 fallback 없이 throw한다", () => {
    vi.stubEnv("PASSWORD_INTENT_SIGNING_SECRET", "");

    expect(() =>
      createSignedIntent({
        purpose: "signup-set-password",
        userId: TEST_USER_ID,
        redirectPath: TEST_REDIRECT_PATH,
        nowSeconds: NOW_SECONDS,
      }),
    ).toThrow("PASSWORD_INTENT_SIGNING_SECRET is not configured");
  });

  it("signing secret이 없으면 verifier도 fallback 없이 throw한다", () => {
    const token = createSignedIntent({
      purpose: "signup-set-password",
      userId: TEST_USER_ID,
      redirectPath: TEST_REDIRECT_PATH,
      nowSeconds: NOW_SECONDS,
    });

    vi.stubEnv("PASSWORD_INTENT_SIGNING_SECRET", "");

    expect(() =>
      verifySignedIntent({
        token,
        expectedPurpose: "signup-set-password",
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      }),
    ).toThrow("PASSWORD_INTENT_SIGNING_SECRET is not configured");
  });
});
