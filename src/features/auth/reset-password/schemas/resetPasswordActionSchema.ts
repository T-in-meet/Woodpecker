import { z } from "zod";

import { VALIDATION_MESSAGES } from "@/lib/validation/messages";
import { passwordFieldSchema } from "@/lib/validation/passwordSchema";

export const resetPasswordActionSchema = z
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

export type ResetPasswordActionInput = z.infer<
  typeof resetPasswordActionSchema
>;
