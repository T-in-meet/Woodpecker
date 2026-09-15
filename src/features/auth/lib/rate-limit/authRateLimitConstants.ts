/**
 * Password Login Rate Limit
 */
export const LOGIN_EMAIL_ATTEMPT_LIMIT = 10;
export const LOGIN_EMAIL_ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

export const LOGIN_IP_SHORT_LIMIT = 20;
export const LOGIN_IP_SHORT_WINDOW_MS = 60 * 1000;
export const LOGIN_IP_LONG_LIMIT = 100;
export const LOGIN_IP_LONG_WINDOW_MS = 15 * 60 * 1000;

export const LOGIN_FAILURE_STREAK_LIMIT = 5;
export const LOGIN_FAILURE_STREAK_INACTIVITY_MS = 5 * 60 * 1000;

/**
 * OTP Issue Rate Limit
 */
export const OTP_ISSUE_EMAIL_SUCCESS_LIMIT = 6;
export const OTP_ISSUE_EMAIL_SUCCESS_WINDOW_MS = 15 * 60 * 1000;
export const OTP_ISSUE_COOLDOWN_MS = 15 * 1000;

export const OTP_ISSUE_IP_SHORT_LIMIT = 10;
export const OTP_ISSUE_IP_SHORT_WINDOW_MS = 60 * 1000;
export const OTP_ISSUE_IP_LONG_LIMIT = 50;
export const OTP_ISSUE_IP_LONG_WINDOW_MS = 15 * 60 * 1000;

/**
 * OTP Verify Rate Limit
 */
export const OTP_VERIFY_EMAIL_ATTEMPT_LIMIT = 5;
export const OTP_VERIFY_EMAIL_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

export const OTP_VERIFY_IP_SHORT_LIMIT = 15;
export const OTP_VERIFY_IP_SHORT_WINDOW_MS = 60 * 1000;
export const OTP_VERIFY_IP_LONG_LIMIT = 60;
export const OTP_VERIFY_IP_LONG_WINDOW_MS = 15 * 60 * 1000;

export const OTP_VERIFY_FAILURE_STREAK_LIMIT = 5;
export const OTP_VERIFY_FAILURE_STREAK_INACTIVITY_MS = 10 * 60 * 1000;
