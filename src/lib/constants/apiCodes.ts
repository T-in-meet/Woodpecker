export const API_CODES = {
  SIGNUP_SUCCESS: "SIGNUP_SUCCESS",
} as const;

export type ApiCode = (typeof API_CODES)[keyof typeof API_CODES];
