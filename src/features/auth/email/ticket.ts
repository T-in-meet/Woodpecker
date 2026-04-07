import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const MIN_DECODED_LENGTH = IV_LENGTH + TAG_LENGTH + 1;

/**
 * Ticket payload
 *
 * - v: payload version
 * - th: Supabase token_hash
 *
 * 외부 공개 계약은 여전히 string <-> string 이지만,
 * 내부적으로는 확장 가능한 payload 구조를 사용한다.
 */
type TicketPayload = {
  v: 1;
  th: string;
};

/**
 * Derive a fixed 32-byte AES key from EMAIL_TICKET_SECRET.
 *
 * 왜 필요한가?
 * - aes-256-gcm은 정확히 32바이트 키를 요구한다.
 * - 환경변수 문자열을 그대로 Buffer.from(secret) 하면
 *   길이가 항상 32바이트라고 보장할 수 없다.
 *
 * 처리 방식:
 * - 사람이 관리하는 secret 문자열을 SHA-256으로 해시해
 *   항상 32바이트 키로 변환한다.
 */
function getKey(): Buffer {
  const secret = process.env["EMAIL_TICKET_SECRET"];

  if (!secret) {
    throw new Error("EMAIL_TICKET_SECRET is not set");
  }

  return createHash("sha256").update(secret, "utf8").digest();
}

/**
 * Convert binary data to base64url.
 *
 * 목적:
 * - ticket를 query parameter에 넣을 수 있도록
 *   URL-safe 문자열로 변환한다.
 *
 * 예:
 * - "+" -> "-"
 * - "/" -> "_"
 * - "=" padding 제거
 */
function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Convert base64url string back to binary.
 *
 * 목적:
 * - ticket 문자열을 다시 복호화 가능한 Buffer로 복원한다.
 */
function fromBase64Url(str: string): Buffer {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64");
}

/**
 * Validate decrypted payload shape.
 *
 * 목적:
 * - 복호화에 성공했더라도 payload 구조가 기대한 형식인지 확인한다.
 * - 내부 확장 시에도 version 체크 지점을 유지할 수 있다.
 */
function isTicketPayload(value: unknown): value is TicketPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  if (!("v" in value) || !("th" in value)) {
    return false;
  }

  return (
    (value as { v: unknown }).v === 1 &&
    typeof (value as { th: unknown }).th === "string"
  );
}

/**
 * Encrypt token_hash into an opaque ticket.
 *
 * 외부 계약:
 * - input: tokenHash string
 * - output: URL-safe ticket string
 *
 * 내부 처리:
 * 1. tokenHash를 payload 객체로 감싼다.
 * 2. JSON 문자열로 직렬화한다.
 * 3. AES-256-GCM으로 암호화한다.
 * 4. [iv | authTag | ciphertext]를 base64url로 변환한다.
 */
export function encryptTicket(tokenHash: string): string {
  const key = getKey();

  /**
   * GCM nonce(IV)
   *
   * - 12 bytes는 GCM에서 일반적으로 사용하는 표준 길이
   * - 요청마다 랜덤 생성하여 같은 token_hash라도
   *   항상 다른 ticket이 나오게 한다.
   */
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  /**
   * 내부 payload 구조
   *
   * 지금은 token_hash만 담지만,
   * 나중에 exp, purpose 등을 추가하기 쉬운 구조다.
   */
  const payload: TicketPayload = {
    v: 1,
    th: tokenHash,
  };

  const plaintext = JSON.stringify(payload);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  /**
   * GCM authentication tag
   *
   * - 복호화 시 무결성 검증에 사용된다.
   * - ticket이 조작되면 decipher.final() 단계에서 실패한다.
   */
  const tag = cipher.getAuthTag();

  /**
   * 최종 저장 포맷
   *
   * [ iv | tag | encrypted ]
   *
   * 순서는 decryptTicket에서도 동일하게 해석해야 한다.
   */
  const combined = Buffer.concat([iv, tag, encrypted]);

  return toBase64Url(combined);
}

/**
 * Decrypt ticket and return original token_hash.
 *
 * 외부 계약:
 * - input: ticket string
 * - output: tokenHash string
 *
 * 내부 처리:
 * 1. base64url decode
 * 2. [iv | tag | ciphertext] 분리
 * 3. AES-256-GCM 복호화
 * 4. JSON parse
 * 5. payload.th 반환
 */
export function decryptTicket(ticket: string): string {
  if (!ticket) {
    throw new Error("Invalid ticket: empty");
  }

  const combined = fromBase64Url(ticket);

  /**
   * 최소 길이 검증
   *
   * 최소 구성:
   * - iv: 12
   * - tag: 16
   * - ciphertext: 최소 1 이상
   */
  if (combined.length < MIN_DECODED_LENGTH) {
    throw new Error("Invalid ticket: too short");
  }

  /**
   * encryptTicket에서 합친 순서대로 다시 분리한다.
   */
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);

  /**
   * 복호화 전에 auth tag를 설정해야
   * GCM 무결성 검증이 수행된다.
   */
  decipher.setAuthTag(tag);

  let decrypted: string;

  try {
    decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    /**
     * 보통 아래 경우 여기서 실패한다.
     * - ticket이 조작됨
     * - key가 다름
     * - tag가 손상됨
     * - iv/ciphertext가 손상됨
     */
    throw new Error("Invalid ticket: authentication failed");
  }

  let payload: unknown;

  try {
    payload = JSON.parse(decrypted);
  } catch {
    /**
     * 복호화는 되었지만 JSON 형식이 아니면
     * 우리가 기대한 ticket payload가 아니다.
     */
    throw new Error("Invalid ticket: malformed payload");
  }

  if (!isTicketPayload(payload)) {
    throw new Error("Invalid ticket: malformed payload");
  }

  /**
   * 외부 함수 계약은 기존과 동일하게 유지한다.
   *
   * 즉, 내부적으로는 payload 구조를 쓰더라도
   * 최종적으로는 token_hash 문자열만 반환한다.
   */
  return payload.th;
}
