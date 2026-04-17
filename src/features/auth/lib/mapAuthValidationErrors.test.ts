import { describe, expect, it } from "vitest";
import { z } from "zod";

import { VALIDATION_REASON } from "@/lib/validation/reasons";

import { mapAuthValidationErrors } from "./mapAuthValidationErrors";

describe("mapAuthValidationErrors", () => {
  it("invalid_type: 값이 없으면 REQUIRED로 매핑한다", () => {
    const schema = z.object({
      age: z.number(),
    });
    const input = {};
    const parsed = schema.safeParse(input);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const errors = mapAuthValidationErrors(parsed.error, input);
    expect(errors).toEqual([
      { field: "age", reason: VALIDATION_REASON.REQUIRED },
    ]);
  });

  it("invalid_type: 값이 null이면 REQUIRED로 매핑한다", () => {
    const schema = z.object({
      age: z.number(),
    });
    const input = { age: null };
    const parsed = schema.safeParse(input);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const errors = mapAuthValidationErrors(parsed.error, input);
    expect(errors).toEqual([
      { field: "age", reason: VALIDATION_REASON.REQUIRED },
    ]);
  });

  it("invalid_type: 값은 있으나 타입이 다르면 INVALID_TYPE으로 매핑한다", () => {
    const schema = z.object({
      age: z.number(),
    });
    const input = { age: "17" };
    const parsed = schema.safeParse(input);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const errors = mapAuthValidationErrors(parsed.error, input);
    expect(errors).toEqual([
      { field: "age", reason: VALIDATION_REASON.INVALID_TYPE },
    ]);
  });

  it("too_small: 빈 문자열이면 REQUIRED로 매핑한다", () => {
    const schema = z.object({
      nickname: z.string().min(2),
    });
    const input = { nickname: " " };
    const parsed = schema.safeParse(input);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const errors = mapAuthValidationErrors(parsed.error, input);
    expect(errors).toEqual([
      { field: "nickname", reason: VALIDATION_REASON.REQUIRED },
    ]);
  });

  it("too_small: empty string이면 REQUIRED로 매핑한다", () => {
    const schema = z.object({
      nickname: z.string().min(2),
    });
    const input = { nickname: "" };
    const parsed = schema.safeParse(input);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const errors = mapAuthValidationErrors(parsed.error, input);
    expect(errors).toEqual([
      { field: "nickname", reason: VALIDATION_REASON.REQUIRED },
    ]);
  });

  it("too_small: 값이 존재하면 TOO_SHORT로 매핑한다", () => {
    const schema = z.object({
      nickname: z.string().min(3),
    });
    const input = { nickname: "ab" };
    const parsed = schema.safeParse(input);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const errors = mapAuthValidationErrors(parsed.error, input);
    expect(errors).toEqual([
      { field: "nickname", reason: VALIDATION_REASON.TOO_SHORT },
    ]);
  });

  it("too_big: 최대 길이 초과를 TOO_LONG으로 매핑한다", () => {
    const schema = z.object({
      nickname: z.string().max(3),
    });
    const input = { nickname: "abcd" };
    const parsed = schema.safeParse(input);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const errors = mapAuthValidationErrors(parsed.error, input);
    expect(errors).toEqual([
      { field: "nickname", reason: VALIDATION_REASON.TOO_LONG },
    ]);
  });

  it("invalid_format: 이메일 형식 오류를 INVALID_FORMAT으로 매핑한다", () => {
    const schema = z.object({
      email: z.string().email(),
    });
    const input = { email: "invalid-email" };
    const parsed = schema.safeParse(input);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const errors = mapAuthValidationErrors(parsed.error, input);
    expect(errors).toEqual([
      { field: "email", reason: VALIDATION_REASON.INVALID_FORMAT },
    ]);
  });

  it("invalid_value: literal 불일치를 NOT_AGREED로 매핑한다", () => {
    const schema = z.object({
      agreed: z.literal(true),
    });
    const input = { agreed: false };
    const parsed = schema.safeParse(input);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const errors = mapAuthValidationErrors(parsed.error, input);
    expect(errors).toEqual([
      { field: "agreed", reason: VALIDATION_REASON.NOT_AGREED },
    ]);
  });

  it("invalid_value: 값이 없으면 REQUIRED로 매핑한다", () => {
    const schema = z.object({
      agreed: z.literal(true),
    });
    const input = {};
    const parsed = schema.safeParse(input);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const errors = mapAuthValidationErrors(parsed.error, input);
    expect(errors).toEqual([
      { field: "agreed", reason: VALIDATION_REASON.REQUIRED },
    ]);
  });

  it("루트 path가 비어 있으면 field를 unknown으로 반환한다", () => {
    const schema = z.string();
    const input = 123;
    const parsed = schema.safeParse(input);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const errors = mapAuthValidationErrors(parsed.error, input);
    expect(errors).toEqual([
      { field: "unknown", reason: VALIDATION_REASON.INVALID_TYPE },
    ]);
  });

  it("nested path를 dot notation으로 변환한다", () => {
    const schema = z.object({
      agreements: z.object({
        terms: z.literal(true),
      }),
    });

    const input = { agreements: { terms: false } };
    const parsed = schema.safeParse(input);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const errors = mapAuthValidationErrors(parsed.error, input);

    expect(errors).toEqual([
      {
        field: "agreements.terms",
        reason: VALIDATION_REASON.NOT_AGREED,
      },
    ]);
  });
});
