import { z } from "zod";

const forgotPasswordEmailSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z
    .string()
    .min(1, "이메일을 입력해주세요")
    .email("올바른 이메일을 입력해주세요"),
);

export const forgotPasswordFormSchema = z
  .object({
    email: forgotPasswordEmailSchema,
  })
  .strict();

export type ForgotPasswordFormInput = z.input<typeof forgotPasswordFormSchema>;
export type ForgotPasswordFormValues = z.output<
  typeof forgotPasswordFormSchema
>;
