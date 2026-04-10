import { z } from "zod";

import { normalizedEmailSchema } from "@/lib/validation/emailSchema";
import { normalizedNicknameSchema } from "@/lib/validation/nicknameSchema";
import { passwordSchema } from "@/lib/validation/passwordSchema";

export const signupApiSchema = z.object({
  email: normalizedEmailSchema,
  password: passwordSchema,
  nickname: normalizedNicknameSchema,
  agreements: z.object({
    termsOfService: z.literal(true),
    privacyPolicy: z.literal(true),
  }),
});
