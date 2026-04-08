/**
 * ticket - AEAD 암호화/복호화 순수 함수 테스트
 *
 * 검증 범위:
 * - encryptTicket: token_hash → URL-safe opaque ticket (AES-256-GCM)
 * - decryptTicket: ticket → token_hash 복원
 * - 보안 속성: nonce 기반 비결정성, 원본 노출 불가, 조작 감지
 *
 * mock 없음: 순수 함수 테스트
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { decryptTicket, encryptTicket } from "@/features/auth/email/ticket";

// AES-256-GCM: 32바이트 키 필요
const TEST_SECRET = "test-secret-key-32bytes-minimum!";
const TEST_TOKEN_HASH = "abc123test";
const LONG_TOKEN_HASH = "a1b2c3d4".repeat(8); // 64자 hex string (Supabase token_hash 실제 길이)
const SPECIAL_TOKEN_HASH = "abc!@#$%^&*()";

let originalSecret: string | undefined;

beforeAll(() => {
  originalSecret = process.env["EMAIL_TICKET_SECRET"];
  process.env["EMAIL_TICKET_SECRET"] = TEST_SECRET;
});

afterAll(() => {
  process.env["EMAIL_TICKET_SECRET"] = originalSecret;
});

describe("ticket - AEAD 암호화/복호화 순수 함수 검증", () => {
  it("TC-01. encryptTicket 결과는 원본 token_hash와 다르다", () => {
    const ticket = encryptTicket(TEST_TOKEN_HASH);

    expect(ticket).not.toBe(TEST_TOKEN_HASH);
  });

  it("TC-02. encryptTicket 결과에 원본 token_hash 문자열이 포함되지 않는다", () => {
    const ticket = encryptTicket(TEST_TOKEN_HASH);

    expect(ticket).not.toContain(TEST_TOKEN_HASH);
  });

  it("TC-03. decryptTicket(encryptTicket(tokenHash))는 원본 token_hash를 반환한다", () => {
    const ticket = encryptTicket(TEST_TOKEN_HASH);

    expect(decryptTicket(ticket)).toBe(TEST_TOKEN_HASH);
  });

  it("TC-04. 동일한 token_hash를 두 번 암호화하면 서로 다른 ticket이 생성된다", () => {
    const ticket1 = encryptTicket(TEST_TOKEN_HASH);
    const ticket2 = encryptTicket(TEST_TOKEN_HASH);

    expect(ticket1).not.toBe(ticket2);
  });

  it("TC-05. 서로 다른 두 ticket을 복호화하면 동일한 원본 token_hash가 반환된다", () => {
    const ticket1 = encryptTicket(TEST_TOKEN_HASH);
    const ticket2 = encryptTicket(TEST_TOKEN_HASH);

    expect(decryptTicket(ticket1)).toBe(TEST_TOKEN_HASH);
    expect(decryptTicket(ticket2)).toBe(TEST_TOKEN_HASH);
  });

  it("TC-06. encryptTicket 결과는 URL-safe 문자만 포함한다", () => {
    const ticket = encryptTicket(TEST_TOKEN_HASH);

    expect(ticket).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it("TC-07. 조작된 ticket을 복호화하면 에러를 throw한다", () => {
    expect(() => decryptTicket("tampered-invalid-ticket-value")).toThrow();
  });

  it("TC-08. 빈 문자열 ticket을 복호화하면 에러를 throw한다", () => {
    expect(() => decryptTicket("")).toThrow();
  });

  it("TC-09. 64자 hex string token_hash도 정상적으로 왕복 변환된다", () => {
    const ticket = encryptTicket(LONG_TOKEN_HASH);

    expect(decryptTicket(ticket)).toBe(LONG_TOKEN_HASH);
  });

  it("TC-10. 특수문자를 포함한 token_hash도 정상적으로 왕복 변환된다", () => {
    const ticket = encryptTicket(SPECIAL_TOKEN_HASH);

    expect(decryptTicket(ticket)).toBe(SPECIAL_TOKEN_HASH);
  });

  it("TC-11. 다른 secret으로 decrypt 시 실패한다", () => {
    const ticket = encryptTicket(TEST_TOKEN_HASH);
    const original = process.env["EMAIL_TICKET_SECRET"];
    try {
      process.env["EMAIL_TICKET_SECRET"] = "another-secret";
      expect(() => decryptTicket(ticket)).toThrow();
    } finally {
      process.env["EMAIL_TICKET_SECRET"] = original;
    }
  });
});
