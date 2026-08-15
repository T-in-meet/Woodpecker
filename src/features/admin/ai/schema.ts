import { z } from "zod";

import type { Json } from "@/types/db.helpers";

/** UUID 형식의 문자열을 검증합니다. */
export const uuidSchema = z.string().uuid();

/**
 * 선택 입력 텍스트를 정리합니다.
 *
 * 앞뒤 공백을 제거하고 빈 문자열은 null로 변환합니다.
 */
export const nullableTextSchema = z
  .string()
  .trim()
  .transform((value) => (value.length > 0 ? value : null));

/**
 * 쉼표로 구분된 태그 문자열을 태그 배열로 변환합니다.
 *
 * 각 태그의 앞뒤 공백과 빈 항목은 제거합니다.
 */
export const tagsSchema = z.string().transform((value) =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0),
);

/**
 * JSON 문자열 입력을 애플리케이션의 Json 값으로 변환합니다.
 *
 * 빈 문자열은 null로 처리하고, 유효하지 않은 JSON은 검증 오류로 반환합니다.
 */
export const jsonTextSchema = z.string().transform((value, context): Json => {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  try {
    return JSON.parse(trimmedValue) as Json;
  } catch {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "JSON 형식이 올바르지 않습니다.",
    });

    return z.NEVER;
  }
});
