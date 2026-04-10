import { z } from "zod";

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
  .email("올바른 이메일을 입력해주세요");
