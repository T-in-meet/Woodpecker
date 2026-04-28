import { z } from "zod";

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
        message: "비밀번호가 일치하지 않습니다.",
        path: ["confirmPassword"],
      });
    }
  });

export type ResetPasswordActionInput = z.infer<
  typeof resetPasswordActionSchema
>;
