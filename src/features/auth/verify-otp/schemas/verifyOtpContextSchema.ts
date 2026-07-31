import { z } from "zod";

import { normalizedEmailSchema } from "@/lib/validation/emailSchema";
import { otpPurposeSchema } from "@/lib/validation/otpPurposeSchema";
import { redirectPathSchema } from "@/lib/validation/redirectPathSchema";

export const verifyOtpContextSchema = z
  .object({
    email: normalizedEmailSchema,
    purpose: otpPurposeSchema,
    redirect: redirectPathSchema.optional(),
  })
  .strict();

export type VerifyOtpContext = z.infer<typeof verifyOtpContextSchema>;
