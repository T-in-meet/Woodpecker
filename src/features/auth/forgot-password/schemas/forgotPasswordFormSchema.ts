import { z } from "zod";

import { emailFieldSchema } from "@/lib/validation/emailSchema";

export const forgotPasswordFormSchema = z
  .object({
    email: emailFieldSchema,
  })
  .strict();

export type ForgotPasswordFormInput = z.infer<typeof forgotPasswordFormSchema>;
export type ForgotPasswordFormValues = z.output<
  typeof forgotPasswordFormSchema
>;
