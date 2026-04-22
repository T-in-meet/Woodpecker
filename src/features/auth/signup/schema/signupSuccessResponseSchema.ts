import { z } from "zod";

export const signupSuccessResponseSchema = z.object({
  success: z.literal(true),
  code: z.string(), // 필요하면 enum으로
  data: z.object({
    email: z.string(),
    redirectTo: z.string(),
  }),
});

export type SignupSuccessResponse = z.infer<typeof signupSuccessResponseSchema>;
