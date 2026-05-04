import { z } from "zod";

import { normalizedEmailSchema } from "@/lib/validation/emailSchema";

export const forgotPasswordFormSchema = z
  .object({
    email: normalizedEmailSchema,
  })
  .strict();

export type ForgotPasswordFormInput = z.infer<typeof forgotPasswordFormSchema>;
