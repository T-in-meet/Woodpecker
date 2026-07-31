import { AUTH_LOG_REASONS } from "../../constants/authLogReasons";

/**
 * resend-email action 상태 타입
 *
 * 역할:
 * - resend-email 페이지의 서버 action 결과를 표현한다.
 * - OTP 재전송 성공/실패/차단 상태를 UI에 전달한다.
 *
 * 상태 구분:
 * - idle: 초기 상태
 * - invalid_request: 이전 페이지에서 전달된 context(query) 자체가 잘못된 경우
 * - completed: OTP 재전송 완료
 * - blocked: rate limit 차단
 * - internal_error: 시스템 내부 오류
 * - invalid_input: 사용자가 입력한 email 검증 실패
 */
export type ResendEmailActionState =
  /**
   * 초기 상태
   */
  | {
      status: "idle";
      fieldErrors: null;
    }
  /**
   * 잘못된 요청 상태
   *
   * 이전 페이지에서 전달된 purpose / redirect 등의
   * context 값이 유효하지 않은 경우 사용한다.
   */
  | {
      status: "invalid_request";
      fieldErrors: null;
      reasonCode: typeof AUTH_LOG_REASONS.SCHEMA_VALIDATION_FAILED;
    }
  /**
   * rate limit 차단 상태
   *
   * IP 또는 이메일 기준 제한 초과 시 사용한다.
   */
  | {
      status: "blocked";
      fieldErrors: null;
      reasonCode:
        | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_SHORT
        | typeof AUTH_LOG_REASONS.RATE_LIMIT_IP_LONG
        | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_SHORT
        | typeof AUTH_LOG_REASONS.RATE_LIMIT_EMAIL_LONG;
    }
  /**
   * 시스템 내부 오류 상태
   *
   * OTP 발급 실패, 이메일 전송 실패,
   * 외부 provider 장애 등 서버 내부 문제에 사용한다.
   */
  | {
      status: "internal_error";
      fieldErrors: null;
      reasonCode: typeof AUTH_LOG_REASONS.INTERNAL_ERROR;
    }
  /**
   * 사용자 입력 검증 실패 상태
   *
   * 사용자가 입력한 email 형식이 올바르지 않은 경우 사용한다.
   */
  | {
      status: "invalid_input";
      fieldErrors: {
        email?: string[];
      };
    };

/**
 * resend-email action 초기 상태
 */
export const INITIAL_RESEND_EMAIL_ACTION_STATE: ResendEmailActionState = {
  status: "idle",
  fieldErrors: null,
};
