import { z } from "zod";

import { normalizedEmailSchema } from "@/lib/validation/emailSchema";

export const forgotPasswordFormSchema = z
  .object({
    email: normalizedEmailSchema,
  })
  .strict();

export type ForgotPasswordFormInput = z.input<typeof forgotPasswordFormSchema>;
export type ForgotPasswordFormValues = z.output<
  typeof forgotPasswordFormSchema
>;
