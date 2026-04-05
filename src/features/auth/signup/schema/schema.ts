import { z } from "zod";

import { loginFormSchema } from "../../login/schema/schema";

export const SIGNUP_PASSWORD_MIN = 8;
export const SIGNUP_NICKNAME_MIN = 1;
export const SIGNUP_NICKNAME_MAX = 10;

function trimIfString(val: unknown): unknown {
  return typeof val === "string" ? val.trim() : val;
}

export const signupApiSchema = z.object({
  email: z.preprocess(trimIfString, z.string().min(1).email()),
  password: z.string().min(SIGNUP_PASSWORD_MIN),
  nickname: z.preprocess(
    trimIfString,
    z.string().min(SIGNUP_NICKNAME_MIN).max(SIGNUP_NICKNAME_MAX),
  ),
  agreements: z.object({
    termsOfService: z.literal(true),
    privacyPolicy: z.literal(true),
  }),
});

export type SignupApiInput = z.infer<typeof signupApiSchema>;

export const signupFormSchema = z
  .object({
    email: z.string().email("올바른 이메일을 입력해주세요"),
    password: z.string().min(8, "비밀번호는 8자 이상이어야 합니다"),
    confirmPassword: z.string(),
    nickname: z.preprocess(
      (val) => (typeof val === "string" ? val.trim() : val),
      z
        .string()
        .min(1, "닉네임은 1자 이상이어야 합니다")
        .max(10, "닉네임은 10자 이내로 입력해주세요"),
    ),
    termsOfService: z.boolean().refine((val) => val === true, {
      message: "이용약관에 동의해주세요",
    }),
    privacyPolicy: z.boolean().refine((val) => val === true, {
      message: "개인정보 처리방침에 동의해주세요",
    }),
    avatarFile: z.any().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "비밀번호가 일치하지 않습니다",
    path: ["confirmPassword"],
  });
