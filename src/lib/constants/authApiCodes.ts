import { API_RESULTS, makeApiActionCode, makeApiCode } from "./apiCodes";

export const AUTH_API_CODES = {
  SIGNUP_SUCCESS: makeApiCode("signup", API_RESULTS.SUCCESS),
  SIGNUP_INVALID_INPUT: makeApiCode("signup", API_RESULTS.INVALID_INPUT),
  SIGNUP_RATE_LIMIT_EXCEEDED: makeApiCode("signup", API_RESULTS.RATE_LIMITED),
  EMAIL_VERIFICATION_RESEND_SUCCESS: makeApiActionCode(
    "email-verification",
    "resend",
    API_RESULTS.SUCCESS,
  ),
  EMAIL_VERIFICATION_RESEND_COOLDOWN_CONFLICT: makeApiActionCode(
    "email-verification",
    "resend-cooldown",
    API_RESULTS.CONFLICT,
  ),
  RESEND_RATE_LIMIT_EXCEEDED: makeApiCode("resend", API_RESULTS.RATE_LIMITED),
} as const;

export type AuthApiCode = (typeof AUTH_API_CODES)[keyof typeof AUTH_API_CODES];
