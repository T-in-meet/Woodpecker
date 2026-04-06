import type { ZodError } from "zod";

import type { ValidationError } from "@/features/auth/lib/response";
import { VALIDATION_REASON } from "@/features/auth/signup/constants/validation";

import { ValidationReason } from "../types/validation.types";

/**
 * Zod issue.path를 따라 원본 input에서 실제 값을 조회하는 유틸 함수
 *
 * 예:
 * - path: ["agreements", "termsOfService"]
 * - input: { agreements: { termsOfService: false } }
 * → false 반환
 *
 * 사용 목적:
 * - Zod issue code만으로는 REQUIRED / INVALID_TYPE 같은 세부 분류가 부족할 수 있음
 * - 실제 입력값이 undefined/null/빈 문자열인지 확인해 정확한 reason을 결정
 */
function getFieldValue(
  input: unknown,
  path: (string | number | symbol)[],
): unknown {
  return path.reduce<unknown>(
    (obj, key) =>
      obj !== null && typeof obj === "object"
        ? (obj as Record<string | number, unknown>)[key as string | number]
        : obj,
    input,
  );
}

/**
 * 개별 Zod issue를 도메인 ValidationReason으로 변환
 *
 * 변환 기준:
 * - invalid_type:
 *   - 값이 null/undefined면 REQUIRED
 *   - 그 외 타입 불일치는 INVALID_TYPE
 * - too_small:
 *   - 값이 비어 있으면 REQUIRED
 *   - 실제 값이 있으나 길이/최소값 부족이면 TOO_SHORT
 * - too_big:
 *   - 최대 길이/최대값 초과 → TOO_LONG
 * - invalid_format:
 *   - 이메일 형식 등 포맷 오류 → INVALID_FORMAT
 * - invalid_value:
 *   - 값이 없으면 REQUIRED
 *   - 주로 z.literal(true) 실패 같은 경우 → NOT_AGREED
 *
 * 기본값:
 * - 명시적으로 처리하지 않은 issue는 INVALID_TYPE으로 처리
 */
function mapIssueToReason(
  issue: ZodError["issues"][number],
  input: unknown,
): ValidationReason {
  switch (issue.code) {
    case "invalid_type": {
      const fieldValue = getFieldValue(input, issue.path);

      /**
       * 값 자체가 없으면 "필수값 누락"으로 해석
       */
      if (fieldValue === null || fieldValue === undefined) {
        return VALIDATION_REASON.REQUIRED;
      }

      /**
       * 값은 있지만 타입이 맞지 않는 경우
       */
      return VALIDATION_REASON.INVALID_TYPE;
    }

    case "too_small": {
      const fieldValue = getFieldValue(input, issue.path);

      /**
       * 빈 문자열 / null / undefined는 길이 부족이라기보다 필수값 누락으로 처리
       */
      if (
        fieldValue === null ||
        fieldValue === undefined ||
        (typeof fieldValue === "string" && fieldValue.trim() === "")
      ) {
        return VALIDATION_REASON.REQUIRED;
      }

      /**
       * 값은 존재하지만 최소 길이/최소 조건 미달
       */
      return VALIDATION_REASON.TOO_SHORT;
    }

    /**
     * 최대 길이/최대 조건 초과
     */
    case "too_big":
      return VALIDATION_REASON.TOO_LONG;

    /**
     * 이메일 등 형식 검증 실패
     */
    case "invalid_format":
      return VALIDATION_REASON.INVALID_FORMAT;

    case "invalid_value": {
      const fieldValue = getFieldValue(input, issue.path);

      /**
       * 값이 없으면 필수값 누락
       */
      if (fieldValue === null || fieldValue === undefined) {
        return VALIDATION_REASON.REQUIRED;
      }

      /**
       * 대표적으로 약관 동의(z.literal(true)) 실패를 의미
       */
      return VALIDATION_REASON.NOT_AGREED;
    }

    /**
     * 현재 명시적으로 분류하지 않는 기타 에러
     */
    default:
      return VALIDATION_REASON.INVALID_TYPE;
  }
}

/**
 * ZodError를 API 응답용 ValidationError[]로 변환
 *
 * 반환 형식:
 * - field: issue.path를 "."으로 join한 문자열
 * - reason: 도메인 ValidationReason
 *
 * 예:
 * - path ["email"] → "email"
 * - path ["agreements", "termsOfService"] → "agreements.termsOfService"
 *
 * path가 비어 있으면 field는 "unknown"으로 처리
 */
export function mapSignupValidationErrors(
  zodError: ZodError,
  input: unknown,
): ValidationError[] {
  return zodError.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "unknown",
    reason: mapIssueToReason(issue, input),
  }));
}
