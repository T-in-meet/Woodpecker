/**
 * Auth 전역 시스템 오류 메시지.
 */
export const AUTH_GLOBAL_ERROR_MESSAGE =
  "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";

/**
 * OTP Email delivery 실패 시 사용자에게 노출하는 일반화된 메시지.
 *
 * Provider/SMTP 상세 원인을 외부에 노출하지 않는다.
 */
export const AUTH_EMAIL_DELIVERY_ERROR_MESSAGE =
  "인증 이메일을 전송하지 못했습니다. 잠시 후 다시 시도해주세요.";
