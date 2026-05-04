import { z } from "zod";

import { emailFormSchema } from "@/lib/validation/emailSchema";

export const verifyEmailFormSchema = z.object({
  email: emailFormSchema,
});

export type VerifyEmailFormInput = z.input<typeof verifyEmailFormSchema>;
export type VerifyEmailFormValues = z.output<typeof verifyEmailFormSchema>;
