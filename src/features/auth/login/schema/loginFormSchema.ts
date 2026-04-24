import { z } from "zod";

import { emailFieldSchema } from "@/lib/validation/emailSchema";
import { passwordFieldSchema } from "@/lib/validation/passwordSchema";

export const loginFormSchema = z
  .object({
    email: emailFieldSchema,
    password: passwordFieldSchema,
  })
  .strict();

export type LoginFormValues = z.infer<typeof loginFormSchema>;
