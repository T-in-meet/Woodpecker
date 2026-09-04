export const OAUTH_CALLBACK_ERROR_PARAM = "oauth_error";

export const OAUTH_CALLBACK_ERROR_MESSAGE =
  "소셜 로그인을 완료할 수 없습니다. 다시 시도해주세요.";

export const OAUTH_CALLBACK_ERROR_REASON = {
  MISSING_CODE: "missing_code",
  EXCHANGE_FAILED: "exchange_failed",
} as const;
