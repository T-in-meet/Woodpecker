import { z } from "zod";

export const loginSuccessResponseSchema = z.object({
  success: z.literal(true),
  code: z.literal("LOGIN_SUCCESS"),
  data: z.object({
    redirectTo: z.string(),
  }),
});

export type LoginSuccessResponse = z.infer<typeof loginSuccessResponseSchema>;
