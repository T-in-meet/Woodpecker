import { createHash } from "node:crypto";

/**
 * AI embedding 캐시 키 구성에 사용할 SHA-256 해시를 생성합니다.
 *
 * 동일한 UTF-8 문자열은 항상 동일한 소문자 hexadecimal hash를 반환합니다.
 *
 * @param value 해시를 생성할 원본 문자열입니다.
 * @returns SHA-256 hexadecimal 문자열입니다.
 */
export function createAiSha256Hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
