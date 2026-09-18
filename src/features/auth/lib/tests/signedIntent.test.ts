/**
 * Signed Intent 단위 테스트.
 *
 * 검증 범위:
 * - Set/Reset Password Intent sign → verify 정상 round-trip
 * - signer 입력 계약(userId / nowSeconds)
 * - HMAC signature 무결성 및 timing-safe 비교 경로
 * - strict base64url / JSON / payload schema 검증
 * - purpose / userId authorization binding
 * - issuedAt / expiresAt / TTL / expiration 경계
 * - signing secret 누락 시 fail-closed 동작
 *
 * 이 테스트는 Signed Intent 자체의 계약만 검증하며,
 * cookie lifecycle과 page/action 연결은 해당 전용 테스트에서 검증한다.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// signedIntent.ts는 server-only를 import하므로 Vitest 환경에서는 비워서 mock한다.
// vi.mock은 정적 import보다 먼저 hoist되므로 아래 signedIntent import가 안전하다.
vi.mock("server-only", () => ({}));

import {
  RESET_PASSWORD_INTENT_TTL_SECONDS,
  SET_PASSWORD_INTENT_TTL_SECONDS,
} from "../rate-limit/authRateLimitConstants";
import {
  createSignedIntent,
  type SignedIntentPayload,
  type SignedIntentPurpose,
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
const NOW_SECONDS = 1_700_000_000;

const PURPOSE_CASES: Array<{
  purpose: SignedIntentPurpose;
  ttlSeconds: number;
}> = [
  {
    purpose: "signup-set-password",
    ttlSeconds: SET_PASSWORD_INTENT_TTL_SECONDS,
  },
  {
    purpose: "reset-password",
    ttlSeconds: RESET_PASSWORD_INTENT_TTL_SECONDS,
  },
];

/** JSON 값을 production wire format과 동일한 base64url payloadPart로 만든다. */
function encodePayload(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

/**
 * 임의 payloadPart에 테스트 secret으로 HMAC-SHA256 signature를 붙인다.
 *
 * verifier의 malformed payload/schema/time 경로를 signer와 독립적으로 검증하기 위한
 * 테스트 전용 helper다.
 */
function signPayloadPart(payloadPart: string): string {
  const signaturePart = createHmac("sha256", TEST_SECRET)
    .update(payloadPart, "utf8")
    .digest("base64url");

  return `${payloadPart}.${signaturePart}`;
}

/** 임의 payload를 정상 signature가 붙은 Signed Intent token으로 만든다. */
function createTokenForPayload(payload: unknown): string {
  return signPayloadPart(encodePayload(payload));
}

/** 기본적으로 유효한 Set Password payload를 생성한다. */
function createValidPayload(
  overrides: Partial<SignedIntentPayload> = {},
): SignedIntentPayload {
  return {
    purpose: "signup-set-password",
    userId: TEST_USER_ID,
    issuedAt: NOW_SECONDS,
    expiresAt: NOW_SECONDS + SET_PASSWORD_INTENT_TTL_SECONDS,
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

  it.each(PURPOSE_CASES)(
    "$purpose Intent를 sign한 뒤 같은 purpose/user로 verify하면 payload를 반환한다",
    ({ purpose, ttlSeconds }) => {
      const token = createSignedIntent({
        purpose,
        userId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      });

      const result = verifySignedIntent({
        token,
        expectedPurpose: purpose,
        expectedUserId: TEST_USER_ID,
        nowSeconds: NOW_SECONDS,
      });

      expect(result).toEqual({
        purpose,
        userId: TEST_USER_ID,
        issuedAt: NOW_SECONDS,
        expiresAt: NOW_SECONDS + ttlSeconds,
      });
    },
  );

  it.each(["", "   "])("signer는 빈/공백 userId(%j)를 거부한다", (userId) => {
    expect(() =>
      createSignedIntent({
        purpose: "signup-set-password",
        userId,
        nowSeconds: NOW_SECONDS,
      }),
    ).toThrow("Password Intent userId is required");
  });

  it.each([-1, NOW_SECONDS + 0.5])(
    "signer는 잘못된 nowSeconds(%s)를 거부한다",
    (nowSeconds) => {
      expect(() =>
        createSignedIntent({
          purpose: "signup-set-password",
          userId: TEST_USER_ID,
          nowSeconds,
        }),
      ).toThrow("Password Intent nowSeconds must be a non-negative integer");
    },
  );

  it("expected purpose가 다르면 같은 사용자 token도 거부한다", () => {
    const token = createSignedIntent({
      purpose: "signup-set-password",
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
    ).toBeNull();
  });

  it("expected userId가 다르면 같은 purpose token도 거부한다", () => {
    const token = createSignedIntent({
      purpose: "signup-set-password",
      userId: TEST_USER_ID,
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
    const payloadPart = encodePayload(createValidPayload());

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
      const payloadPart = encodePayload(createValidPayload());
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
    const payloadPart = encodePayload(createValidPayload());
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
      "필드 누락",
      {
        purpose: "signup-set-password",
        userId: TEST_USER_ID,
        issuedAt: NOW_SECONDS,
      },
    ],
    ["추가 필드", { ...createValidPayload(), extra: true }],
    [
      "unsupported purpose",
      { ...createValidPayload(), purpose: "unsupported-purpose" },
    ],
    ["non-string userId", { ...createValidPayload(), userId: 123 }],
    ["빈 userId", createValidPayload({ userId: "" })],
    ["음수 issuedAt", createValidPayload({ issuedAt: -1 })],
    ["소수 issuedAt", createValidPayload({ issuedAt: NOW_SECONDS + 0.5 })],
    ["음수 expiresAt", createValidPayload({ expiresAt: -1 })],
    ["소수 expiresAt", createValidPayload({ expiresAt: NOW_SECONDS + 1.5 })],
  ])("잘못된 payload schema(%s)는 거부한다", (_name, payload) => {
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

  it.each([
    [
      "future issuedAt",
      createValidPayload({
        issuedAt: NOW_SECONDS + 1,
        expiresAt: NOW_SECONDS + 1 + SET_PASSWORD_INTENT_TTL_SECONDS,
      }),
    ],
    ["expiresAt === issuedAt", createValidPayload({ expiresAt: NOW_SECONDS })],
    [
      "TTL 초과",
      createValidPayload({
        expiresAt: NOW_SECONDS + SET_PASSWORD_INTENT_TTL_SECONDS + 1,
      }),
    ],
    [
      "exact expiration",
      createValidPayload({
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
    const payload = createValidPayload({
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
        nowSeconds: NOW_SECONDS,
      }),
    ).toThrow("PASSWORD_INTENT_SIGNING_SECRET is not configured");
  });

  it("signing secret이 없으면 verifier도 fallback 없이 throw한다", () => {
    const token = createSignedIntent({
      purpose: "signup-set-password",
      userId: TEST_USER_ID,
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
