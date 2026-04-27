export const AUTH_LOG_REASONS = {
  INVALID_JSON: "INVALID_JSON",
  SCHEMA_VALIDATION_FAILED: "SCHEMA_VALIDATION_FAILED",
  // [이유: IP를 단일 윈도우에서 short/long 이중 윈도우로 분리 — sustained 공격 방어를 위해]
  RATE_LIMIT_IP_SHORT: "RATE_LIMIT_IP_SHORT",
  RATE_LIMIT_IP_LONG: "RATE_LIMIT_IP_LONG",
  RATE_LIMIT_EMAIL_SHORT: "RATE_LIMIT_EMAIL_SHORT",
  RATE_LIMIT_EMAIL_LONG: "RATE_LIMIT_EMAIL_LONG",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  /**
   * 인증 자격 증명 불일치
   *
   * 다음 케이스를 내부 로깅 목적으로 동일하게 분류한다:
   * - 존재하지 않는 계정
   * - 비밀번호 불일치
   * - 이메일 미인증 계정
   * - 기타 인증 실패
   *
   * 외부 응답에서는 이 reason code가 노출되지 않는다
   */
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
} as const;

export type AuthLogReason =
  (typeof AUTH_LOG_REASONS)[keyof typeof AUTH_LOG_REASONS];
