import { z } from "zod";

import { PASSWORD_MIN_LENGTH } from "@/lib/constants/user";

/**
 * 비밀번호 스키마 (API / 서버용)
 *
 * 목적:
 * - 서버에서 사용하는 boundary validation
 * - 최소 길이 조건만 검증하여 데이터 유효성 보장
 *
 * 특징:
 * - 사용자 메시지 없음 (UI 관심사 분리)
 * - 단순히 "유효한 값인지"만 판단
 *
 * 사용 위치:
 * - API schema (signupApiSchema 등)
 */
export const passwordSchema = z.string().min(PASSWORD_MIN_LENGTH);

/**
 * 비밀번호 입력 필드 스키마 (UI / Form용)
 *
 * 목적:
 * - 사용자 입력 단계에서 validation 수행
 * - UX 친화적인 에러 메시지 제공
 *
 * 특징:
 * - 최소 길이 미만일 경우 사용자에게 명확한 메시지 제공
 * - 서버 스키마와 동일한 제약을 가지지만 표현만 다름
 *
 * 사용 위치:
 * - signupFormSchema (react-hook-form + zodResolver)
 */
export const passwordFieldSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다`,
  );
