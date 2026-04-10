import { z } from "zod";

import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
} from "@/lib/constants/profiles";

import { trimIfString } from "./trimString";

/**
 * 정규화된 닉네임 스키마 (API / 서버용)
 *
 * 목적:
 * - 외부 입력을 안전하게 처리하기 위한 boundary validation
 * - 문자열 입력에 대해 trim 적용 후 길이 검증 수행
 *
 * 특징:
 * - preprocess로 공백 제거 (예: "  홍길동  " → "홍길동")
 * - 최소/최대 길이만 검증 (메시지 없음)
 * - 사용자 메시지보다 "데이터 유효성 보장"에 집중
 *
 * 사용 위치:
 * - API schema (signupApiSchema 등)
 */
export const normalizedNicknameSchema = z.preprocess(
  trimIfString,
  z.string().min(NICKNAME_MIN_LENGTH).max(NICKNAME_MAX_LENGTH),
);

/**
 * 닉네임 입력 필드 스키마 (UI / Form용)
 *
 * 목적:
 * - 사용자 입력 단계에서 validation 수행
 * - UX 친화적인 에러 메시지 제공
 *
 * 특징:
 * - preprocess로 trim 적용 (UI에서도 공백 제거)
 * - 최소/최대 길이 위반 시 사용자 메시지 반환
 *
 * 사용 위치:
 * - signupFormSchema (react-hook-form + zodResolver)
 */
export const nicknameFieldSchema = z.preprocess(
  trimIfString,
  z
    .string()
    .min(
      NICKNAME_MIN_LENGTH,
      `닉네임은 ${NICKNAME_MIN_LENGTH}자 이상이어야 합니다`,
    )
    .max(
      NICKNAME_MAX_LENGTH,
      `닉네임은 ${NICKNAME_MAX_LENGTH}자 이내로 입력해주세요`,
    ),
);
