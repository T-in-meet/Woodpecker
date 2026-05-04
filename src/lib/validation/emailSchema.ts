import { z } from "zod";

import { VALIDATION_MESSAGES } from "./messages";
import { trimIfString } from "./trimString";

/**
 * 정규화된 이메일 스키마 (API / 서버용)
 *
 * 목적:
 * - 외부 입력을 안전하게 처리하기 위한 boundary validation
 * - 문자열 입력에 대해 trim 적용 후 이메일 형식 검증
 *
 * 특징:
 * - preprocess를 사용하여 공백 제거 (예: " test@test.com " → "test@test.com")
 * - 최소 길이 + 이메일 형식만 검증 (메시지 없음)
 * - 사용자 메시지보다는 "데이터 유효성 보장"에 집중
 *
 * 사용 위치:
 * - API schema (signupApiSchema 등)
 */
export const normalizedEmailSchema = z.preprocess(
  trimIfString,
  z.string().min(1).email(),
);

/**
 * 이메일 입력 필드 스키마 (UI / Form용)
 *
 * 목적:
 * - 사용자 입력 단계에서 validation 수행
 * - UX 친화적인 에러 메시지 제공
 *
 * 특징:
 * - trim 없이 원본 입력 기준으로 검증 (UI 입력 그대로 반영)
 * - 잘못된 입력 시 사용자에게 바로 피드백 제공
 *
 * 사용 위치:
 * - signupFormSchema (react-hook-form + zodResolver)
 */
export const emailFieldSchema = z
  .string()
  .email(VALIDATION_MESSAGES.emailInvalid);

/**
 * 이메일 Form 스키마 (UI / Form 제출용)
 *
 * 목적:
 * - Form 제출 시 최종 validation 수행
 * - 사용자 입력값을 정제(trim)한 뒤 검증
 * - UX 친화적인 메시지 제공 (required + format)
 *
 * 특징:
 * - preprocess로 trim 적용 → " test@test.com " → "test@test.com"
 * - 공백 입력("")에 대해 명확한 required 메시지 제공
 * - 이메일 형식 오류에 대해 사용자 메시지 제공
 *
 * 사용 위치:
 * - react-hook-form + zodResolver 기반 Form
 * - submit 시점 validation
 *
 * 보장:
 * - 공백 입력 → VALIDATION_MESSAGES.emailRequired
 * - 잘못된 형식 → VALIDATION_MESSAGES.emailInvalid
 * - 정상 입력 → trim된 값으로 downstream 전달
 *
 * 권장:
 * - Form validation에서는 emailFieldSchema 대신 이 스키마 사용
 */
export const emailFormSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z
    .string()
    .min(1, VALIDATION_MESSAGES.emailRequired)
    .email(VALIDATION_MESSAGES.emailInvalid),
);
