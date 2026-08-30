import type { Json } from "@/types/db.helpers";

/**
 * 값이 JSONB에 저장 가능한 값인지 확인합니다.
 *
 * @param value 검증할 값
 * @returns Json-compatible 값이면 true
 */
export function isJsonValue(value: unknown): value is Json {
  if (value === null) return true;

  const valueType = typeof value;

  if (
    valueType === "string" ||
    valueType === "number" ||
    valueType === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (valueType === "object") {
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }

  return false;
}
