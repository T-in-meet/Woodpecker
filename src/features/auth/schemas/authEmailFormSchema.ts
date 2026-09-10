import { z } from "zod";

import { emailFormSchema } from "@/lib/validation/emailSchema";

export const authEmailFormSchema = z
  .object({
    email: emailFormSchema,
  })
  .strict();

export type AuthEmailFormInput = z.input<typeof authEmailFormSchema>;
export type AuthEmailFormValues = z.output<typeof authEmailFormSchema>;
