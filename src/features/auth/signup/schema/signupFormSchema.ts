import { z } from "zod";

import { emailFieldSchema } from "@/lib/validation/emailSchema";
import { nicknameFieldSchema } from "@/lib/validation/nicknameSchema";
import { passwordFieldSchema } from "@/lib/validation/passwordSchema";

import { PASSWORD_MISMATCH_MESSAGE } from "../../constants/messages";

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
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: PASSWORD_MISMATCH_MESSAGE,
    path: ["confirmPassword"],
  });
