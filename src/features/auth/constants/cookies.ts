export const RESET_REQUIRED_COOKIE_NAME = "reset-required";

export const RESET_REQUIRED_COOKIE_MAX_AGE_SECONDS = 600;

export const RESET_REQUIRED_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: RESET_REQUIRED_COOKIE_MAX_AGE_SECONDS,
} as const;
