export const AUTH_LOG_REASONS = {
  INVALID_JSON: "INVALID_JSON",
  SCHEMA_VALIDATION_FAILED: "SCHEMA_VALIDATION_FAILED",
  // [이유: IP를 단일 윈도우에서 short/long 이중 윈도우로 분리 — sustained 공격 방어를 위해]
  RATE_LIMIT_IP_SHORT: "RATE_LIMIT_IP_SHORT",
  RATE_LIMIT_IP_LONG: "RATE_LIMIT_IP_LONG",
  RATE_LIMIT_EMAIL_SHORT: "RATE_LIMIT_EMAIL_SHORT",
  RATE_LIMIT_EMAIL_LONG: "RATE_LIMIT_EMAIL_LONG",
  /**
   * Password Login Email total attempt 제한.
   */
  LOGIN_EMAIL_LIMIT: "LOGIN_EMAIL_LIMIT",
  /**
   * Password Login IP attempt 제한.
   *
   * short/long window는 같은 외부 정책 의미이므로 내부 reason도 하나로 묶는다.
   */
  LOGIN_IP_LIMIT: "LOGIN_IP_LIMIT",
  /**
   * Password Login consecutive credential failure streak 제한.
   */
  LOGIN_FAILURE_STREAK: "LOGIN_FAILURE_STREAK",
  /**
   * OTP Verify Email total attempt 제한.
   */
  OTP_VERIFY_EMAIL_LIMIT: "OTP_VERIFY_EMAIL_LIMIT",
  /**
   * OTP Verify IP attempt 제한.
   *
   * short/long window는 같은 외부 정책 의미이므로 내부 reason도 하나로 묶는다.
   */
  OTP_VERIFY_IP_LIMIT: "OTP_VERIFY_IP_LIMIT",
  /**
   * OTP Verify consecutive validity failure streak 제한.
   */
  OTP_VERIFY_FAILURE_STREAK: "OTP_VERIFY_FAILURE_STREAK",
  /**
   * Auth Provider 자체 Rate Limit.
   *
   * Woodpecker local Rate Limit과 내부적으로 구분한다.
   */
  PROVIDER_RATE_LIMIT: "PROVIDER_RATE_LIMIT",
  /**
   * 명확한 authentication rejection 또는 Provider Rate Limit이 아닌
   * Provider/System 오류.
   */
  PROVIDER_ERROR: "PROVIDER_ERROR",
  /**
   * OTP 발급 이후 커스텀 Email delivery 계층에서 발생한 실패.
   *
   * Provider/System 오류와 구분하여 기록하며 외부에는 상세 원인을 노출하지 않는다.
   */
  EMAIL_DELIVERY_ERROR: "EMAIL_DELIVERY_ERROR",
  /**
   * Vercel Preview/Production에서 신뢰 가능한 사용자 IP를 확보하지 못한 상태.
   *
   * 외부 응답에는 이 내부 사유를 노출하지 않는다.
   */
  IP_UNAVAILABLE: "IP_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  /**
   * 인증 자격 증명 불일치.
   *
   * Provider classifier가 명확히 allowlist한 credential failure에만 사용한다.
   * 외부 응답에서는 이 reason code가 노출되지 않는다.
   */
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INVALID_OTP: "INVALID_OTP",
  SAME_PASSWORD: "SAME_PASSWORD",
} as const;

export type AuthLogReason =
  (typeof AUTH_LOG_REASONS)[keyof typeof AUTH_LOG_REASONS];
