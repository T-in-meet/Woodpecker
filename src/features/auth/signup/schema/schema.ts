import { z } from "zod";

import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
} from "@/lib/constants/profiles";
import { PASSWORD_MIN_LENGTH } from "@/lib/constants/user";

// Boundary helper
// 문자열 입력에 대해서만 trim 적용 (API/Form 입력 정규화용)
function trimIfString(val: unknown): unknown {
  return typeof val === "string" ? val.trim() : val;
}

// API Schema (Server Boundary)
// 서버가 받는 요청 payload 검증용
//
// 목적:
// - 외부 입력 구조 검증
// - 최소 제약 조건 검증 (길이, 형식)
// - agreements 필수 동의 여부 확인
//
// 특징:
// - confirmPassword는 UI 전용 필드이므로 포함하지 않음
// - 메시지보다는 "데이터 유효성" 검증에 집중
export const signupApiSchema = z.object({
  email: z.preprocess(trimIfString, z.string().min(1).email()),
  password: z.string().min(PASSWORD_MIN_LENGTH),
  nickname: z.preprocess(
    trimIfString,
    z.string().min(NICKNAME_MIN_LENGTH).max(NICKNAME_MAX_LENGTH),
  ),
  agreements: z.object({
    termsOfService: z.literal(true),
    privacyPolicy: z.literal(true),
  }),
});

export type SignupApiInput = z.infer<typeof signupApiSchema>;

// Form Schema (Client UI Validation)
// 회원가입 폼에서 사용하는 클라이언트 검증용 스키마
//
// 목적:
// - 사용자 입력 검증 및 UX 친화적인 에러 메시지 제공
// - confirmPassword 일치 여부 검증
// - 약관 동의 여부 검증
//
// 특징:
// - API 스키마보다 UI 중심 (메시지 포함)
// - avatarFile은 폼 상태 유지를 위해 optional로 포함
// - 실제 API 요청 시에는 confirmPassword, avatarFile은 제외하고 변환 필요
export const signupFormSchema = z
  .object({
    email: z.string().email("올바른 이메일을 입력해주세요"),
    password: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다`,
      ),
    confirmPassword: z.string(),
    nickname: z.preprocess(
      (val) => (typeof val === "string" ? val.trim() : val),
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
    ),
    termsOfService: z.boolean().refine((val) => val === true, {
      message: "이용약관에 동의해주세요",
    }),
    privacyPolicy: z.boolean().refine((val) => val === true, {
      message: "개인정보 처리방침에 동의해주세요",
    }),
    // 파일 업로드는 타입 안전하게 처리하기 어렵기 때문에 any 사용
    // 필요 시 unknown + 타입가드로 개선 가능
    avatarFile: z.any().optional(),
  })
  // cross-field validation
  // password와 confirmPassword 일치 여부 검증
  // 에러는 confirmPassword 필드에 귀속시켜 UI에서 표시
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  });

export const signupSuccessResponseSchema = z.object({
  data: z.object({
    email: z.string().email(),
    redirectTo: z.string(),
    signupAccountStatus: z.union([z.literal("active"), z.literal("pending")]),
  }),
});

export type SignupSuccessResponse = z.infer<typeof signupSuccessResponseSchema>;
