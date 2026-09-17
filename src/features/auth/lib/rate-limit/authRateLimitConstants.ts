/**
 * Password Login Email total attempt 정책.
 *
 * 같은 canonicalEmail의 실제 Password Login Provider attempt를
 * rolling/sliding 5분 window에서 최대 10회까지 허용한다.
 *
 * Provider operation이 시작되지 않은 local 차단/검증 실패는 포함하지 않는다.
 */
export const LOGIN_EMAIL_ATTEMPT_LIMIT = 10;
export const LOGIN_EMAIL_ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

/**
 * Password Login IP attempt 정책.
 *
 * 같은 사용자 IP에 short/long rolling window를 함께 적용한다.
 * 두 window 중 하나라도 한도에 도달하면 Login Provider operation을 시작하지 않는다.
 */
export const LOGIN_IP_SHORT_LIMIT = 20;
export const LOGIN_IP_SHORT_WINDOW_MS = 60 * 1000;
export const LOGIN_IP_LONG_LIMIT = 100;
export const LOGIN_IP_LONG_WINDOW_MS = 15 * 60 * 1000;

/**
 * Password Login credential failure streak 정책.
 *
 * 명확한 invalid credential 실패만 연속 실패로 기록한다.
 * 성공하면 streak를 clear하고, 마지막 countable failure 이후 5분 동안
 * 새 countable failure가 없으면 기존 streak를 만료된 것으로 취급한다.
 * Provider 429/system error는 streak를 증가시키거나 reset하지 않는다.
 */
export const LOGIN_FAILURE_STREAK_LIMIT = 5;
export const LOGIN_FAILURE_STREAK_INACTIVITY_MS = 5 * 60 * 1000;

/**
 * OTP Issue Email successful-issue quota.
 *
 * signup/reset-password purpose별 canonicalEmail 상태를 독립적으로 관리한다.
 * generateLink, email_otp 확보, email send가 모두 성공한 Issue만
 * rolling/sliding 15분 window의 성공 횟수에 포함한다.
 */
export const OTP_ISSUE_EMAIL_SUCCESS_LIMIT = 6;
export const OTP_ISSUE_EMAIL_SUCCESS_WINDOW_MS = 15 * 60 * 1000;

/**
 * OTP Issue attempt cooldown.
 *
 * purpose + canonicalEmail 기준으로 마지막 Provider operation 시작 시점부터
 * 15초 동안 새로운 Issue 시작을 막는다.
 * Provider operation이 시작된 뒤에는 성공/실패와 관계없이 cooldown을 유지한다.
 */
export const OTP_ISSUE_COOLDOWN_MS = 15 * 1000;

/**
 * OTP Issue IP attempt 정책.
 *
 * signup/reset-password purpose가 같은 IP quota를 공유하며,
 * short/long rolling window를 함께 적용한다.
 */
export const OTP_ISSUE_IP_SHORT_LIMIT = 10;
export const OTP_ISSUE_IP_SHORT_WINDOW_MS = 60 * 1000;
export const OTP_ISSUE_IP_LONG_LIMIT = 50;
export const OTP_ISSUE_IP_LONG_WINDOW_MS = 15 * 60 * 1000;

/**
 * Signup Resend pre-lookup request IP 정책.
 *
 * account 존재 여부를 확인하기 전 Signup Resend 요청 자체를 제한하여
 * 반복적인 account lookup resource abuse를 방어한다.
 *
 * OTP Issue IP attempt와 같은 제한 수치를 사용하지만 별도 state/key를 사용한다.
 */
export const SIGNUP_RESEND_REQUEST_IP_SHORT_LIMIT = 10;
export const SIGNUP_RESEND_REQUEST_IP_SHORT_WINDOW_MS = 60 * 1000;
export const SIGNUP_RESEND_REQUEST_IP_LONG_LIMIT = 50;
export const SIGNUP_RESEND_REQUEST_IP_LONG_WINDOW_MS = 15 * 60 * 1000;

/**
 * OTP Verify Email total attempt 정책.
 *
 * signup/reset-password purpose별 canonicalEmail 상태를 독립적으로 관리한다.
 * 이 quota만 rolling/sliding이 아니라 첫 attempt에서 시작하는
 * simple fixed 10-minute window를 사용한다.
 */
export const OTP_VERIFY_EMAIL_ATTEMPT_LIMIT = 5;
export const OTP_VERIFY_EMAIL_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

/**
 * OTP Verify IP attempt 정책.
 *
 * signup/reset-password Verify가 같은 IP quota를 공유하며,
 * short/long rolling window를 함께 적용한다.
 */
export const OTP_VERIFY_IP_SHORT_LIMIT = 15;
export const OTP_VERIFY_IP_SHORT_WINDOW_MS = 60 * 1000;
export const OTP_VERIFY_IP_LONG_LIMIT = 60;
export const OTP_VERIFY_IP_LONG_WINDOW_MS = 15 * 60 * 1000;

/**
 * OTP Verify authentication failure streak 정책.
 *
 * 같은 canonicalEmail의 signup/reset-password Verify가 streak를 공유한다.
 * 명확한 OTP validity failure만 연속 실패로 기록하며 성공 시 clear한다.
 * 마지막 countable failure 이후 10분 inactivity가 지나면 만료된 것으로 본다.
 * OTP 재발급이나 purpose 변경만으로는 reset하지 않는다.
 */
export const OTP_VERIFY_FAILURE_STREAK_LIMIT = 5;
export const OTP_VERIFY_FAILURE_STREAK_INACTIVITY_MS = 10 * 60 * 1000;

/**
 * Signup OTP Verify 성공 후 발급하는 Set Password Intent TTL.
 *
 * timestamp는 epoch seconds를 사용하며 Intent 발급 시점부터 15분간 유효하다.
 */
export const SET_PASSWORD_INTENT_TTL_SECONDS = 15 * 60;

/**
 * Recovery OTP Verify 성공 후 발급하는 Reset Password Intent TTL.
 *
 * timestamp는 epoch seconds를 사용하며 Intent 발급 시점부터 15분간 유효하다.
 */
export const RESET_PASSWORD_INTENT_TTL_SECONDS = 15 * 60;
