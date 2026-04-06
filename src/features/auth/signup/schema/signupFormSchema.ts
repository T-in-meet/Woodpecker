import { z } from "zod";

import { emailFieldSchema } from "@/lib/validation/emailSchema";
import { nicknameFieldSchema } from "@/lib/validation/nicknameSchema";
import { passwordFieldSchema } from "@/lib/validation/passwordSchema";

export const signupFormSchema = z
  .object({
    email: emailFieldSchema,
    password: passwordFieldSchema,
    confirmPassword: z.string(),
    nickname: nicknameFieldSchema,
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
