import { z } from "zod";

import { emailFieldSchema } from "@/lib/validation/emailSchema";
import { VALIDATION_MESSAGES } from "@/lib/validation/messages";
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
    privacyPolicyAcknowledged: z.boolean().refine((val) => val === true, {
      message: "개인정보 처리방침을 확인해주세요",
    }),
    age14OrOlder: z.boolean().refine((val) => val === true, {
      message: "만 14세 이상만 가입할 수 있습니다",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: VALIDATION_MESSAGES.passwordMismatch,
    path: ["confirmPassword"],
  });
