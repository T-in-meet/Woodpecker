import { ROUTES } from "@/lib/constants/routes";

export const AUTH_CALLBACK_PATH = "/api/auth/callback";
export const RESET_PASSWORD_PATH = ROUTES.RESET_PASSWORD;
export const SET_PASSWORD_PATH = ROUTES.SET_PASSWORD;
export const SET_PASSWORD_COMPLETE_PATH = "/set-password/complete";
export const FORGOT_PASSWORD_PATH = ROUTES.FORGOT_PASSWORD;
export const DEFAULT_POST_RESET_PATH = ROUTES.MYPAGE;

export const SET_PASSWORD_INTENT_CLEANUP_PATH =
  "/api/auth/set-password/cleanup";

export const RESET_PASSWORD_INTENT_CLEANUP_PATH =
  "/api/auth/reset-password/cleanup";

export const VERIFY_OTP_PATH = ROUTES.VERIFY_OTP;
export const RESEND_EMAIL_PATH = ROUTES.RESEND_EMAIL;
