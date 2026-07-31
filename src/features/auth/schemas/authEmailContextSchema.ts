import { z } from "zod";

import { otpPurposeSchema } from "@/lib/validation/otpPurposeSchema";
import { redirectPathSchema } from "@/lib/validation/redirectPathSchema";

export const authEmailContextSchema = z
  .object({
    purpose: otpPurposeSchema,
    redirect: redirectPathSchema.optional(),
  })
  .strict();

export type AuthEmailContext = z.infer<typeof authEmailContextSchema>;
