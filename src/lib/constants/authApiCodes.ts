import { API_RESULTS, makeApiCode } from "./apiCodes";

export const AUTH_API_CODES = {
  SIGNUP_SUCCESS: makeApiCode("signup", API_RESULTS.SUCCESS),
  SIGNUP_INVALID_INPUT: makeApiCode("signup", API_RESULTS.INVALID_INPUT),
} as const;

export type AuthApiCode = (typeof AUTH_API_CODES)[keyof typeof AUTH_API_CODES];
