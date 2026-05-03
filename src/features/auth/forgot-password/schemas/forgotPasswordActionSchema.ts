import { z } from "zod";

import { normalizedEmailSchema } from "@/lib/validation/emailSchema";

export const forgotPasswordActionSchema = z
  .object({
    email: normalizedEmailSchema,
  })
  .strict();

export type ForgotPasswordActionInput = z.infer<
  typeof forgotPasswordActionSchema
>;
