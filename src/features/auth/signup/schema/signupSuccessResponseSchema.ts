import { z } from "zod";

export const signupSuccessResponseSchema = z.object({
  data: z.object({
    email: z.string().email(),
    redirectTo: z.string(),
  }),
});

export type SignupSuccessResponse = z.infer<typeof signupSuccessResponseSchema>;
