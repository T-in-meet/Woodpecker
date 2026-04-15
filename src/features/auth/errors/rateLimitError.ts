import { AUTH_API_CODES } from "../constants/authApiCodes";

/**
 * rate limit 발생 시 사용자에게 노출할 공통 토스트 메시지
 *
 * 설계 원칙:
 * - 모든 rate limit 케이스에서 동일한 메시지를 사용한다.
 * - 내부 상태(남은 횟수, window, 사용자 상태 등)는 외부에 노출하지 않는다.
 */
export const RATE_LIMIT_TOAST_MESSAGE =
  "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.";

/**
 * rate limit 에러 판별 타입 가드
 *
 * 역할:
 * - 서버 failure response body를 기반으로 rate limit 여부를 판단한다.
 * - HTTP status(예: 429)가 아닌, response body의 `code`를 기준으로 판별한다.
 *
 * 설계 의도:
 * - 클라이언트 로직은 transport 계층(status)이 아닌
 *   application 계층(response contract)에만 의존하도록 한다.
 * - signup / resend 등 auth 도메인 전반에서 공통으로 사용한다.
 *
 * 판별 기준:
 * - error가 객체인지 확인
 * - `code` 필드 존재 여부 확인
 * - rate limit 관련 AUTH_API_CODES인지 확인
 *
 * 주의:
 * - 이 함수는 서버에서 내려준 failure body를 그대로 전달받는 것을 전제로 한다.
 * - 다른 형태의 에러(global error, network error 등)는 false를 반환한다.
 */
export function isRateLimitError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;

  return (
    "code" in e &&
    (e.code === AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED ||
      e.code === AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED)
  );
}
