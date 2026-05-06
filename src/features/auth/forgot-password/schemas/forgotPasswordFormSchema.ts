import { z } from "zod";

import { emailFormSchema } from "@/lib/validation/emailSchema";

export const forgotPasswordFormSchema = z
  .object({
    email: emailFormSchema,
  })
  .strict();

export type ForgotPasswordFormInput = z.input<typeof forgotPasswordFormSchema>;
export type ForgotPasswordFormValues = z.output<
  typeof forgotPasswordFormSchema
>;
