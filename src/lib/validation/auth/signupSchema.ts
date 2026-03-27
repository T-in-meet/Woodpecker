import { z } from "zod";

export const SIGNUP_PASSWORD_MIN = 8;
export const SIGNUP_NICKNAME_MIN = 1;
export const SIGNUP_NICKNAME_MAX = 10;

function trimIfString(val: unknown): unknown {
  return typeof val === "string" ? val.trim() : val;
}

export const signupApiSchema = z.object({
  email: z.preprocess(trimIfString, z.string().min(1).email()),
  password: z.string().min(SIGNUP_PASSWORD_MIN),
  nickname: z.preprocess(
    trimIfString,
    z.string().min(SIGNUP_NICKNAME_MIN).max(SIGNUP_NICKNAME_MAX),
  ),
});

export type SignupApiInput = z.infer<typeof signupApiSchema>;
