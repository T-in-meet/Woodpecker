import type { AuthError } from "@supabase/supabase-js";

/**
 * 현재 Woodpecker Auth 흐름에서 명시적으로 해석하는 Supabase Auth error code.
 *
 * 새로운 Provider code가 추가되더라도 자동으로 authentication failure로
 * 간주하지 않고, 이 allowlist에 명시적으로 추가된 code만 해석한다.
 */
const SUPABASE_AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: "invalid_credentials",
  EMAIL_NOT_CONFIRMED: "email_not_confirmed",
  OTP_EXPIRED: "otp_expired",
  SAME_PASSWORD: "same_password",
  OVER_REQUEST_RATE_LIMIT: "over_request_rate_limit",
  OVER_EMAIL_SEND_RATE_LIMIT: "over_email_send_rate_limit",
} as const;

/**
 * 현재 Supabase 계약에서 확인한 authentication failure HTTP status.
 *
 * status와 code가 모두 현재 확정 fixture와 일치하는 경우에만
 * operation-specific authentication failure로 인정한다.
 */
const SUPABASE_AUTH_ERROR_STATUS = {
  INVALID_CREDENTIALS: 400,
  EMAIL_NOT_CONFIRMED: 400,
  OTP_EXPIRED: 403,
  SAME_PASSWORD: 422,
} as const;

/**
 * Provider error classifier가 실제로 사용하는 최소 입력 계약.
 *
 * Supabase AuthError 전체 객체 중 분류에 필요한 status/code만 사용하여
 * raw message에 분류 로직이 의존하지 않도록 한다.
 */
type AuthProviderErrorInput = Pick<AuthError, "code" | "status">;

/**
 * 공통 Provider 오류 분류 결과.
 *
 * operation별 credential/OTP failure 여부는 이 타입에 포함하지 않는다.
 * 해당 의미는 Login/OTP Verify 계층이 별도로 판단한다.
 */
export type AuthProviderErrorClassification =
  | "provider_rate_limit"
  | "provider_error";

/**
 * Supabase Auth Provider 오류를 공통 범주로 분류한다.
 *
 * 다음은 Provider Rate Limit으로 처리한다.
 * - HTTP 429
 * - 현재 allowlist에 포함된 Supabase Rate Limit code
 *
 * 그 외 오류는 Provider/System 오류로 처리한다.
 *
 * @param error Supabase Auth Provider 오류
 * @returns 공통 Provider 오류 분류
 */
export function classifyAuthProviderError(
  error: AuthProviderErrorInput,
): AuthProviderErrorClassification {
  if (
    error.status === 429 ||
    error.code === SUPABASE_AUTH_ERROR_CODES.OVER_REQUEST_RATE_LIMIT ||
    error.code === SUPABASE_AUTH_ERROR_CODES.OVER_EMAIL_SEND_RATE_LIMIT
  ) {
    return "provider_rate_limit";
  }

  return "provider_error";
}

/**
 * Password update Provider 오류 분류 결과.
 */
export type PasswordUpdateErrorClassification =
  | "same_password"
  | AuthProviderErrorClassification;

/**
 * Password update에서만 의미가 있는 same_password를 먼저 해석한다.
 *
 * same_password는 HTTP 422 + stable code 조합에서만 인정하며,
 * 그 외 오류는 기존 공통 Provider classifier 규칙을 그대로 따른다.
 */
export function classifyPasswordUpdateError(
  error: AuthProviderErrorInput,
): PasswordUpdateErrorClassification {
  if (
    error.status === SUPABASE_AUTH_ERROR_STATUS.SAME_PASSWORD &&
    error.code === SUPABASE_AUTH_ERROR_CODES.SAME_PASSWORD
  ) {
    return "same_password";
  }

  return classifyAuthProviderError(error);
}

/**
 * Password Login 오류가 countable invalid credential failure인지 확인한다.
 *
 * 현재 확정 allowlist:
 * - HTTP 400
 * - code = invalid_credentials
 *
 * Provider Rate Limit 또는 다른 Auth 오류는 credential failure로 추정하지 않는다.
 *
 * @param error Supabase Auth Provider 오류
 * @returns countable Password Login credential failure 여부
 */
export function isPasswordLoginCredentialFailure(
  error: AuthProviderErrorInput,
): boolean {
  return (
    error.status === SUPABASE_AUTH_ERROR_STATUS.INVALID_CREDENTIALS &&
    error.code === SUPABASE_AUTH_ERROR_CODES.INVALID_CREDENTIALS
  );
}

/**
 * Password Login 오류가 streak에는 포함되지 않지만
 * 외부에서는 일반 로그인 실패로 숨겨야 하는 인증 거절인지 확인한다.
 *
 * 현재 확정 allowlist:
 * - HTTP 400
 * - code = email_not_confirmed
 *
 * unknown Provider 오류를 authentication rejection으로 추정하지 않는다.
 *
 * @param error Supabase Auth Provider 오류
 * @returns non-credential Password Login authentication failure 여부
 */
export function isPasswordLoginNonCredentialAuthFailure(
  error: AuthProviderErrorInput,
): boolean {
  return (
    error.status === SUPABASE_AUTH_ERROR_STATUS.EMAIL_NOT_CONFIRMED &&
    error.code === SUPABASE_AUTH_ERROR_CODES.EMAIL_NOT_CONFIRMED
  );
}

/**
 * OTP Verify 오류가 countable OTP validity failure인지 확인한다.
 *
 * 현재 Supabase Verify는 wrong/expired/unusable OTP를
 * HTTP 403 + otp_expired로 반환한다.
 *
 * @param error Supabase Auth Provider 오류
 * @returns countable OTP validity failure 여부
 */
export function isOtpValidityFailure(error: AuthProviderErrorInput): boolean {
  return (
    error.status === SUPABASE_AUTH_ERROR_STATUS.OTP_EXPIRED &&
    error.code === SUPABASE_AUTH_ERROR_CODES.OTP_EXPIRED
  );
}
