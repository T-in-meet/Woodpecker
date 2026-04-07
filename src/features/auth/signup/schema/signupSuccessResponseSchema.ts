import { z } from "zod";

export const signupSuccessResponseSchema = z.object({
  data: z.object({
    email: z.string().email(),
    redirectTo: z.string(),
    signupAccountStatus: z.union([z.literal("active"), z.literal("pending")]),
  }),
});

export type SignupSuccessResponse = z.infer<typeof signupSuccessResponseSchema>;
