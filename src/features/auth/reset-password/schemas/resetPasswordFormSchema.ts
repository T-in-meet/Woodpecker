import { z } from "zod";

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
        message: "비밀번호가 일치하지 않습니다.",
        path: ["confirmPassword"],
      });
    }
  });

export type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>;
