import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import {
  RESET_PASSWORD_INTENT_TTL_SECONDS,
  SET_PASSWORD_INTENT_TTL_SECONDS,
} from "./rate-limit/authRateLimitConstants";

/**
 * Signed Intent가 허용하는 인증 목적.
 *
 * 동일한 signing primitive를 Set Password와 Reset Password가 공유하되,
 * verifier에서 expected purpose를 반드시 다시 확인해 흐름 간 Intent 재사용을 막는다.
 */
export type SignedIntentPurpose = "signup-set-password" | "reset-password";

/**
 * Signed Intent에 공통으로 포함되는 payload.
 *
 * timestamp는 모두 epoch seconds를 사용한다.
 *
 * @property userId Intent가 귀속되는 Supabase Auth user id
 * @property issuedAt Intent 발급 시각
 * @property expiresAt Intent 만료 시각
 */
type SignedIntentBasePayload = {
  userId: string;
  issuedAt: number;
  expiresAt: number;
};

/** Set Password는 final destination provenance를 signed redirectPath로 소유한다. */
export type SetPasswordIntentPayload = SignedIntentBasePayload & {
  purpose: "signup-set-password";
  redirectPath: string;
};

/** Reset Password는 기존 exact 4-claim payload를 유지한다. */
export type ResetPasswordIntentPayload = SignedIntentBasePayload & {
  purpose: "reset-password";
};

export type SignedIntentPayload =
  | SetPasswordIntentPayload
  | ResetPasswordIntentPayload;

type CreateSetPasswordSignedIntentParams = {
  purpose: "signup-set-password";
  userId: string;
  redirectPath: string;
  nowSeconds?: number;
};

type CreateResetPasswordSignedIntentParams = {
  purpose: "reset-password";
  userId: string;
  nowSeconds?: number;
};

type CreateSignedIntentParams =
  | CreateSetPasswordSignedIntentParams
  | CreateResetPasswordSignedIntentParams;

/**
 * Signed Intent 검증 입력.
 *
 * purpose와 userId는 caller가 기대하는 값을 반드시 전달해야 하며,
 * verifier 내부에서 payload와 직접 비교한다.
 * `nowSeconds`는 deterministic test를 위해 선택적으로 주입할 수 있다.
 */
type VerifySignedIntentParams<P extends SignedIntentPurpose> = {
  token: string;
  expectedPurpose: P;
  expectedUserId: string;
  nowSeconds?: number;
};

/** Reset Password payload에 허용되는 exact key 목록. */
const RESET_PASSWORD_PAYLOAD_KEYS = [
  "purpose",
  "userId",
  "issuedAt",
  "expiresAt",
] as const;

/** Set Password payload는 redirectPath까지 포함한 exact 5-claim schema다. */
const SET_PASSWORD_PAYLOAD_KEYS = [
  ...RESET_PASSWORD_PAYLOAD_KEYS,
  "redirectPath",
] as const;

/**
 * HMAC-SHA256 digest의 고정 byte 길이.
 *
 * timingSafeEqual 호출 전 길이를 검증해 길이 불일치에 따른 예외를 피한다.
 */
const HMAC_SHA256_DIGEST_BYTES = 32;

/** padding 없는 canonical base64url 문자 집합. */
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Signed Intent 전용 signing secret을 반환한다.
 *
 * 런타임 임시 secret 생성이나 다른 secret으로의 fallback은 허용하지 않는다.
 * 설정이 누락되거나 공백이면 configuration error로 즉시 실패한다.
 *
 * @returns Signed Intent HMAC signing secret
 * @throws PASSWORD_INTENT_SIGNING_SECRET이 없거나 공백인 경우
 */
function getSignedIntentSigningSecret(): string {
  const secret = process.env.PASSWORD_INTENT_SIGNING_SECRET;

  if (!secret || secret.trim().length === 0) {
    throw new Error("PASSWORD_INTENT_SIGNING_SECRET is not configured");
  }

  return secret;
}

/**
 * Signed Intent purpose에 해당하는 최대 TTL을 반환한다.
 *
 * Set Password와 Reset Password는 현재 모두 15분이지만,
 * 정책 상수를 purpose별로 분리해 향후 정책 변경 시 책임을 유지한다.
 */
function getSignedIntentTtlSeconds(purpose: SignedIntentPurpose): number {
  return purpose === "signup-set-password"
    ? SET_PASSWORD_INTENT_TTL_SECONDS
    : RESET_PASSWORD_INTENT_TTL_SECONDS;
}

/**
 * canonical base64url 문자열을 안전하게 decode한다.
 *
 * Node.js의 base64url decoder가 일부 비정규 입력을 관대하게 처리할 수 있으므로,
 * decode 후 다시 encode한 결과가 원본과 정확히 같은지 확인한다.
 *
 * malformed/non-canonical 입력은 예외를 외부로 전파하지 않고 `null`로 수렴시킨다.
 */
function decodeCanonicalBase64Url(value: string): Buffer | null {
  if (!value || !BASE64URL_PATTERN.test(value)) {
    return null;
  }

  try {
    const decoded = Buffer.from(value, "base64url");

    // 동일한 bytes를 다시 canonical base64url로 encode했을 때
    // 원본과 다르면 non-canonical 입력으로 간주한다.
    if (decoded.toString("base64url") !== value) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}

/** 예상하지 않은 claim이 포함된 payload도 schema 불일치로 거부한다. */
function hasExactKeys(
  record: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const keys = Object.keys(record);

  return (
    keys.length === expectedKeys.length &&
    expectedKeys.every((key) => key in record)
  );
}

function hasValidBasePayloadFields(record: Record<string, unknown>): boolean {
  return (
    typeof record.userId === "string" &&
    record.userId.trim().length > 0 &&
    typeof record.issuedAt === "number" &&
    Number.isInteger(record.issuedAt) &&
    record.issuedAt >= 0 &&
    typeof record.expiresAt === "number" &&
    Number.isInteger(record.expiresAt) &&
    record.expiresAt >= 0
  );
}

/** signature 검증 이후 Set Password exact 5-claim runtime schema를 확인한다. */
function isSetPasswordIntentPayload(
  value: unknown,
): value is SetPasswordIntentPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    hasExactKeys(record, SET_PASSWORD_PAYLOAD_KEYS) &&
    record.purpose === "signup-set-password" &&
    hasValidBasePayloadFields(record) &&
    typeof record.redirectPath === "string" &&
    record.redirectPath.trim().length > 0
  );
}

/** signature 검증 이후 Reset Password exact 4-claim runtime schema를 확인한다. */
function isResetPasswordIntentPayload(
  value: unknown,
): value is ResetPasswordIntentPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    hasExactKeys(record, RESET_PASSWORD_PAYLOAD_KEYS) &&
    record.purpose === "reset-password" &&
    hasValidBasePayloadFields(record)
  );
}

function parsePayloadForPurpose(
  value: unknown,
  purpose: "signup-set-password",
): SetPasswordIntentPayload | null;
function parsePayloadForPurpose(
  value: unknown,
  purpose: "reset-password",
): ResetPasswordIntentPayload | null;
function parsePayloadForPurpose(
  value: unknown,
  purpose: SignedIntentPurpose,
): SignedIntentPayload | null {
  if (purpose === "signup-set-password") {
    return isSetPasswordIntentPayload(value) ? value : null;
  }

  return isResetPasswordIntentPayload(value) ? value : null;
}

/**
 * Set/Reset Password 흐름에서 사용할 Signed Intent를 생성한다.
 *
 * wire format:
 * `base64url(payload JSON).base64url(HMAC-SHA256(payloadPart))`
 *
 * HMAC 입력은 JSON 재직렬화 결과가 아니라 실제 전송되는 payloadPart 자체다.
 * verifier도 동일한 wire payloadPart를 사용해 signature를 재계산한다.
 * Set은 exact 5-claim, Reset은 exact 4-claim payload를 생성한다.
 *
 * @returns signed Intent token
 * @throws userId/redirectPath/nowSeconds가 생성 계약을 만족하지 않는 경우
 * @throws PASSWORD_INTENT_SIGNING_SECRET이 설정되지 않은 경우
 */
export function createSignedIntent({
  purpose,
  userId,
  nowSeconds = Math.floor(Date.now() / 1000),
  ...purposeSpecific
}: CreateSignedIntentParams): string {
  if (userId.trim().length === 0) {
    throw new Error("Password Intent userId is required");
  }

  if (!Number.isInteger(nowSeconds) || nowSeconds < 0) {
    throw new Error(
      "Password Intent nowSeconds must be a non-negative integer",
    );
  }

  const ttlSeconds = getSignedIntentTtlSeconds(purpose);
  const basePayload: SignedIntentBasePayload = {
    userId,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + ttlSeconds,
  };

  let payload: SignedIntentPayload;

  if (purpose === "signup-set-password") {
    const { redirectPath } = purposeSpecific as {
      redirectPath?: string;
    };

    if (!redirectPath || redirectPath.trim().length === 0) {
      throw new Error("Set Password Intent redirectPath is required");
    }

    payload = {
      purpose,
      ...basePayload,
      redirectPath,
    };
  } else {
    payload = {
      purpose,
      ...basePayload,
    };
  }

  const payloadPart = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  // JSON을 다시 직렬화한 값이 아니라 실제 wire payloadPart를 서명한다.
  const signaturePart = createHmac("sha256", getSignedIntentSigningSecret())
    .update(payloadPart, "utf8")
    .digest("base64url");

  return `${payloadPart}.${signaturePart}`;
}

/**
 * Signed Intent의 무결성, exact schema, authorization binding, TTL/expiration을 검증한다.
 *
 * 검증 순서:
 * 1. token 2-part 구조
 * 2. signature canonical base64url 및 digest 길이
 * 3. wire payloadPart 기준 HMAC 재계산 + timing-safe 비교
 * 4. signature 성공 후 payload decode/JSON parse
 * 5. expected purpose에 따른 exact runtime schema
 * 6. current user binding
 * 7. issuedAt/expiresAt/maximum TTL/expiration
 *
 * malformed 또는 authorization 불일치는 null로 수렴하지만 signing secret 누락 같은
 * configuration error는 숨기지 않고 fail-closed 예외를 유지한다.
 */
export function verifySignedIntent(
  params: VerifySignedIntentParams<"signup-set-password">,
): SetPasswordIntentPayload | null;
export function verifySignedIntent(
  params: VerifySignedIntentParams<"reset-password">,
): ResetPasswordIntentPayload | null;
export function verifySignedIntent({
  token,
  expectedPurpose,
  expectedUserId,
  nowSeconds = Math.floor(Date.now() / 1000),
}: VerifySignedIntentParams<SignedIntentPurpose>): SignedIntentPayload | null {
  if (
    expectedUserId.trim().length === 0 ||
    !Number.isInteger(nowSeconds) ||
    nowSeconds < 0
  ) {
    return null;
  }

  // Signed Intent는 payload.signature 두 부분만 허용한다.
  const tokenParts = token.split(".");

  if (tokenParts.length !== 2) {
    return null;
  }

  const [payloadPart, signaturePart] = tokenParts;

  if (!payloadPart || !signaturePart) {
    return null;
  }

  const providedSignature = decodeCanonicalBase64Url(signaturePart);

  // timingSafeEqual은 동일 길이 Buffer만 비교할 수 있으므로 먼저 digest 길이를 확인한다.
  if (
    !providedSignature ||
    providedSignature.length !== HMAC_SHA256_DIGEST_BYTES
  ) {
    return null;
  }

  // payload 내부를 해석하기 전에 전송된 payloadPart 자체의 무결성을 검증한다.
  const expectedSignature = createHmac("sha256", getSignedIntentSigningSecret())
    .update(payloadPart, "utf8")
    .digest();

  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    return null;
  }

  // signature가 유효한 경우에만 payload를 decode하고 내용을 신뢰하기 시작한다.
  const payloadBuffer = decodeCanonicalBase64Url(payloadPart);

  if (!payloadBuffer) {
    return null;
  }

  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(payloadBuffer.toString("utf8"));
  } catch {
    return null;
  }

  const payload =
    expectedPurpose === "signup-set-password"
      ? parsePayloadForPurpose(parsedPayload, "signup-set-password")
      : parsePayloadForPurpose(parsedPayload, "reset-password");

  if (!payload || payload.userId !== expectedUserId) {
    return null;
  }

  const ttlSeconds = getSignedIntentTtlSeconds(expectedPurpose);

  // 시간 계약:
  // - 미래에 발급된 Intent는 허용하지 않는다.
  // - expiresAt은 issuedAt보다 반드시 뒤여야 한다.
  // - 발급된 TTL은 purpose별 최대 TTL을 초과할 수 없다.
  // - expiresAt 시각부터는 즉시 만료된 것으로 본다.
  if (
    payload.issuedAt > nowSeconds ||
    payload.expiresAt <= payload.issuedAt ||
    payload.expiresAt - payload.issuedAt > ttlSeconds ||
    nowSeconds >= payload.expiresAt
  ) {
    return null;
  }

  return payload;
}
