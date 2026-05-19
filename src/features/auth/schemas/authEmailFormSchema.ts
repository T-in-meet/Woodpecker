import { z } from "zod";

import { normalizedEmailSchema } from "@/lib/validation/emailSchema";

export const authEmailFormSchema = z
  .object({
    email: normalizedEmailSchema,
  })
  .strict();

export type AuthEmailFormValues = z.infer<typeof authEmailFormSchema>;
