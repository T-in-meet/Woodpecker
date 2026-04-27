export const AUTH_EVENTS = {
  AUTH_SIGNUP_REQUESTED: "AUTH_SIGNUP_REQUESTED",
  AUTH_SIGNUP_COMPLETED: "AUTH_SIGNUP_COMPLETED",
  AUTH_SIGNUP_FAILED: "AUTH_SIGNUP_FAILED",
  AUTH_RESEND_REQUESTED: "AUTH_RESEND_REQUESTED",
  AUTH_RESEND_COMPLETED: "AUTH_RESEND_COMPLETED",
  AUTH_RESEND_FAILED: "AUTH_RESEND_FAILED",
  AUTH_CALLBACK_REQUESTED: "AUTH_CALLBACK_REQUESTED",
  AUTH_CALLBACK_COMPLETED: "AUTH_CALLBACK_COMPLETED",
  AUTH_CALLBACK_FAILED: "AUTH_CALLBACK_FAILED",
  AUTH_CALLBACK_REJECTED: "AUTH_CALLBACK_REJECTED",
  AUTH_RATE_LIMIT_BLOCKED: "AUTH_RATE_LIMIT_BLOCKED",
  AUTH_INVALID_INPUT: "AUTH_INVALID_INPUT",
  /**
   * 로그인 요청이 수신된 시점에 기록
   * - route handler 진입 직후 1회만 기록한다
   */
  AUTH_LOGIN_REQUESTED: "AUTH_LOGIN_REQUESTED",
  /**
   * 로그인 인증이 정상적으로 완료된 경우 기록
   * - 성공 응답(LOGIN_SUCCESS)이 반환될 때만 해당한다
   */
  AUTH_LOGIN_COMPLETED: "AUTH_LOGIN_COMPLETED",
  /**
   * 로그인이 실패한 경우 기록
   *
   * 다음 경우를 모두 포함한다:
   * - 인증 실패 (INVALID_CREDENTIALS)
   * - 내부 시스템 오류 (INTERNAL_ERROR)
   *
   * 외부 응답 코드와 무관하게 내부 logging event로만 사용한다
   */
  AUTH_LOGIN_FAILED: "AUTH_LOGIN_FAILED",
} as const;

export type AuthEvent = (typeof AUTH_EVENTS)[keyof typeof AUTH_EVENTS];

/**
 * route handler 진입 시 기록하는 REQUESTED 이벤트 유니온
 * logRequested 함수의 파라미터 타입으로 사용된다
 */
export type RequestedAuthEvent =
  | typeof AUTH_EVENTS.AUTH_SIGNUP_REQUESTED
  | typeof AUTH_EVENTS.AUTH_RESEND_REQUESTED
  | typeof AUTH_EVENTS.AUTH_CALLBACK_REQUESTED
  | typeof AUTH_EVENTS.AUTH_LOGIN_REQUESTED;

// 주의:
// AUTH_CALLBACK_REJECTED는 예외가 아니라 callback 흐름의 정상적인 분기 결과다.
export type CallbackAuthEvent =
  | typeof AUTH_EVENTS.AUTH_CALLBACK_COMPLETED
  | typeof AUTH_EVENTS.AUTH_CALLBACK_REJECTED;

/**
 * 예상하지 못한 예외 또는 시스템 오류로 인한 실패 이벤트 유니온
 * logAuthError 함수의 파라미터 타입으로 사용된다
 */
export type AuthFailureEvent =
  | typeof AUTH_EVENTS.AUTH_SIGNUP_FAILED
  | typeof AUTH_EVENTS.AUTH_RESEND_FAILED
  | typeof AUTH_EVENTS.AUTH_CALLBACK_FAILED
  | typeof AUTH_EVENTS.AUTH_LOGIN_FAILED;

/**
 * 정상 처리 완료(success) 이벤트 유니온
 * rate limit / invalid_input과 함께 logAuthEvent에서 사용된다
 */
export type AuthCompletedEvent =
  | typeof AUTH_EVENTS.AUTH_SIGNUP_COMPLETED
  | typeof AUTH_EVENTS.AUTH_RESEND_COMPLETED
  | typeof AUTH_EVENTS.AUTH_LOGIN_COMPLETED;

/**
 * logAuthEvent에서 처리하는 이벤트 유니온
 * success / blocked / invalid_input 결과에 해당한다
 */
export type AuthNonFailureEvent =
  | AuthCompletedEvent
  | typeof AUTH_EVENTS.AUTH_RATE_LIMIT_BLOCKED
  | typeof AUTH_EVENTS.AUTH_INVALID_INPUT;
