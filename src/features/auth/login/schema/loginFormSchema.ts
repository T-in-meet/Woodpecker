import { z } from "zod";

import { emailFieldSchema } from "@/lib/validation/emailSchema";

export const loginFormSchema = z
  .object({
    email: emailFieldSchema,
    password: z.string().min(1, "비밀번호를 입력해주세요"),
  })
  .strict();

export type LoginFormValues = z.infer<typeof loginFormSchema>;
