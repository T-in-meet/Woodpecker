import { z } from "zod";

import { VALIDATION_MESSAGES } from "@/lib/validation/messages";
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
        message: VALIDATION_MESSAGES.passwordMismatch,
        path: ["confirmPassword"],
      });
    }
  });

export type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>;
