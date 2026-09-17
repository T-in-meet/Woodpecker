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
 * Signed Intent에 포함되는 공통 payload.
 *
 * timestamp는 모두 epoch seconds를 사용한다.
 *
 * @property purpose Intent가 허용하는 password flow
 * @property userId Intent가 귀속되는 Supabase Auth user id
 * @property issuedAt Intent 발급 시각
 * @property expiresAt Intent 만료 시각
 */
export type SignedIntentPayload = {
  purpose: SignedIntentPurpose;
  userId: string;
  issuedAt: number;
  expiresAt: number;
};

/**
 * Signed Intent 생성 입력.
 *
 * `nowSeconds`는 deterministic test를 위해 선택적으로 주입할 수 있다.
 */
type CreateSignedIntentParams = {
  purpose: SignedIntentPurpose;
  userId: string;
  nowSeconds?: number;
};

/**
 * Signed Intent 검증 입력.
 *
 * purpose와 userId는 caller가 기대하는 값을 반드시 전달해야 하며,
 * verifier 내부에서 payload와 직접 비교한다.
 *
 * `nowSeconds`는 deterministic test를 위해 선택적으로 주입할 수 있다.
 */
type VerifySignedIntentParams = {
  token: string;
  expectedPurpose: SignedIntentPurpose;
  expectedUserId: string;
  nowSeconds?: number;
};

/**
 * 허용된 payload key 목록.
 *
 * 예상하지 않은 필드가 포함된 payload도 schema 불일치로 거부하기 위해 사용한다.
 */
const SIGNED_INTENT_PAYLOAD_KEYS = [
  "purpose",
  "userId",
  "issuedAt",
  "expiresAt",
] as const;

/**
 * HMAC-SHA256 digest의 고정 byte 길이.
 *
 * timingSafeEqual 호출 전 길이를 검증해 길이 불일치에 따른 예외를 피한다.
 */
const HMAC_SHA256_DIGEST_BYTES = 32;

/**
 * padding 없는 canonical base64url 문자 집합.
 */
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
 *
 * @param purpose Signed Intent 목적
 * @returns 허용 TTL(second)
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
 *
 * @param value decode할 base64url 문자열
 * @returns decode된 Buffer 또는 invalid 입력인 경우 null
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

/**
 * unknown 값이 허용된 Signed Intent purpose인지 확인한다.
 */
function isSignedIntentPurpose(value: unknown): value is SignedIntentPurpose {
  return value === "signup-set-password" || value === "reset-password";
}

/**
 * signature 검증을 통과한 parsed JSON이 정확한 Signed Intent schema인지 확인한다.
 *
 * 다음을 모두 요구한다.
 * - plain object
 * - 정확히 4개의 허용 필드만 존재
 * - 유효한 purpose
 * - 비어 있지 않은 userId
 * - non-negative integer epoch seconds
 *
 * @param value JSON.parse 결과
 * @returns SignedIntentPayload schema와 정확히 일치하는지 여부
 */
function isSignedIntentPayload(value: unknown): value is SignedIntentPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);

  // 예상하지 않은 추가 필드가 포함된 payload도 허용하지 않는다.
  if (
    keys.length !== SIGNED_INTENT_PAYLOAD_KEYS.length ||
    !SIGNED_INTENT_PAYLOAD_KEYS.every((key) => key in record)
  ) {
    return false;
  }

  return (
    isSignedIntentPurpose(record.purpose) &&
    typeof record.userId === "string" &&
    record.userId.trim().length > 0 &&
    Number.isInteger(record.issuedAt) &&
    typeof record.issuedAt === "number" &&
    record.issuedAt >= 0 &&
    Number.isInteger(record.expiresAt) &&
    typeof record.expiresAt === "number" &&
    record.expiresAt >= 0
  );
}

/**
 * Set/Reset Password 흐름에서 사용할 Signed Intent를 생성한다.
 *
 * wire format:
 *
 * `base64url(payload JSON).base64url(HMAC-SHA256(payloadPart))`
 *
 * HMAC 입력은 JSON 원문이 아니라 실제 전송되는 `payloadPart` 자체다.
 * verifier도 동일한 문자열을 그대로 사용해 signature를 재계산한다.
 *
 * @param params Intent 생성 정보
 * @returns signed Intent token
 * @throws userId가 비어 있거나 nowSeconds가 잘못된 경우
 * @throws PASSWORD_INTENT_SIGNING_SECRET이 설정되지 않은 경우
 */
export function createSignedIntent({
  purpose,
  userId,
  nowSeconds = Math.floor(Date.now() / 1000),
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
  const payload: SignedIntentPayload = {
    purpose,
    userId,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + ttlSeconds,
  };

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
 * Signed Intent의 무결성, schema, authorization binding,
 * TTL 및 만료 여부를 검증한다.
 *
 * 검증 순서는 다음과 같다.
 *
 * 1. token 2-part 구조 확인
 * 2. signature base64url 형식 및 SHA-256 digest 길이 확인
 * 3. 전달받은 payloadPart로 HMAC 재계산
 * 4. timing-safe signature 비교
 * 5. signature 성공 후에만 payload decode / JSON parse
 * 6. schema 검증
 * 7. expected purpose / current user id binding 검증
 * 8. issuedAt / expiresAt / 최대 TTL / expiration 검증
 *
 * malformed 또는 authorization 조건을 만족하지 않는 입력은 모두 `null`로
 * 수렴시킨다. 반면 signing secret 누락은 사용자 입력 오류가 아니라
 * 배포/configuration 오류이므로 숨기지 않고 fail-closed 예외를 유지한다.
 *
 * @param params 검증할 token과 caller가 기대하는 authorization context
 * @returns 검증된 payload 또는 invalid Intent인 경우 null
 * @throws PASSWORD_INTENT_SIGNING_SECRET이 설정되지 않은 경우
 */
export function verifySignedIntent({
  token,
  expectedPurpose,
  expectedUserId,
  nowSeconds = Math.floor(Date.now() / 1000),
}: VerifySignedIntentParams): SignedIntentPayload | null {
  if (
    expectedUserId.trim().length === 0 ||
    !Number.isInteger(nowSeconds) ||
    nowSeconds < 0
  ) {
    return null;
  }

  const tokenParts = token.split(".");

  // Signed Intent는 payload.signature 두 부분만 허용한다.
  if (tokenParts.length !== 2) {
    return null;
  }

  const [payloadPart, signaturePart] = tokenParts;

  if (!payloadPart || !signaturePart) {
    return null;
  }

  const providedSignature = decodeCanonicalBase64Url(signaturePart);

  // timingSafeEqual은 동일 길이 Buffer만 비교할 수 있으므로
  // HMAC-SHA256 digest 길이를 먼저 확인한다.
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

  if (!isSignedIntentPayload(parsedPayload)) {
    return null;
  }

  // Intent가 다른 password flow 또는 다른 사용자에게 재사용되는 것을 막는다.
  if (
    parsedPayload.purpose !== expectedPurpose ||
    parsedPayload.userId !== expectedUserId
  ) {
    return null;
  }

  const ttlSeconds = getSignedIntentTtlSeconds(expectedPurpose);

  // 시간 계약:
  // - 미래에 발급된 Intent는 허용하지 않는다.
  // - expiresAt은 issuedAt보다 반드시 뒤여야 한다.
  // - 발급된 TTL은 purpose별 최대 TTL을 초과할 수 없다.
  // - expiresAt 시각부터는 즉시 만료된 것으로 본다.
  if (
    parsedPayload.issuedAt > nowSeconds ||
    parsedPayload.expiresAt <= parsedPayload.issuedAt ||
    parsedPayload.expiresAt - parsedPayload.issuedAt > ttlSeconds ||
    nowSeconds >= parsedPayload.expiresAt
  ) {
    return null;
  }

  return parsedPayload;
}
