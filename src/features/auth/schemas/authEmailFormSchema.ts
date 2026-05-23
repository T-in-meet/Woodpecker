import { z } from "zod";

import { normalizedEmailSchema } from "@/lib/validation/emailSchema";

export const authEmailFormSchema = z
  .object({
    email: normalizedEmailSchema,
  })
  .strict();

export type AuthEmailFormInput = z.input<typeof authEmailFormSchema>;
export type AuthEmailFormValues = z.output<typeof authEmailFormSchema>;
