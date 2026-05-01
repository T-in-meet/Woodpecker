import { z } from "zod";

import { PASSWORD_MISMATCH_MESSAGE } from "@/features/auth/constants/messages";
import { passwordFieldSchema } from "@/lib/validation/passwordSchema";

export const resetPasswordFormSchema = z
  .object({
    password: passwordFieldSchema,
    confirmPassword: z.string(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: PASSWORD_MISMATCH_MESSAGE,
        path: ["confirmPassword"],
      });
    }
  });

export type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>;
