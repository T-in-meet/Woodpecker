import {
  API_RESULTS,
  makeApiActionCode,
  makeApiCode,
} from "@/lib/constants/apiCodes";

/**
 * 인증(Auth) 도메인에서 사용하는 API 코드 집합
 *
 * - 모든 응답은 "code" 필드를 통해 클라이언트와 명확한 계약을 가짐
 * - 문자열을 직접 사용하지 않고, 생성 함수를 통해 일관된 포맷 유지
 * - 도메인 + 결과(API_RESULTS)를 조합하여 코드 생성
 *
 * 예:
 * - signup + SUCCESS → "SIGNUP_SUCCESS" 형태
 * - email-verification + resend + SUCCESS → 액션 기반 코드
 */
export const AUTH_API_CODES = {
  /**
   * 회원가입 성공
   * - 정상적으로 회원이 생성된 경우
   */
  SIGNUP_SUCCESS: makeApiCode("signup", API_RESULTS.SUCCESS),

  /**
   * 회원가입 입력값 오류
   * - zod validation 실패 등 (422)
   */
  SIGNUP_INVALID_INPUT: makeApiCode("signup", API_RESULTS.INVALID_INPUT),

  /**
   * 회원가입 요청 횟수 초과
   * - rate limit에 걸린 경우 (429)
   */
  SIGNUP_RATE_LIMIT_EXCEEDED: makeApiCode("signup", API_RESULTS.RATE_LIMITED),

  /**
   * 이메일 인증 재전송 성공
   * - resend API 정상 동작
   */
  EMAIL_VERIFICATION_RESEND_SUCCESS: makeApiActionCode(
    "email-verification",
    "resend",
    API_RESULTS.SUCCESS,
  ),

  /**
   * 이메일 재전송 쿨다운 충돌
   * - 일정 시간 내 재요청 → cooldown 상태 (409)
   */
  EMAIL_VERIFICATION_RESEND_COOLDOWN_CONFLICT: makeApiActionCode(
    "email-verification",
    "resend-cooldown",
    API_RESULTS.CONFLICT,
  ),

  /**
   * 재전송 입력값 오류
   * - 이메일 형식 등 validation 실패
   */
  RESEND_INVALID_INPUT: makeApiCode("resend", API_RESULTS.INVALID_INPUT),

  /**
   * 재전송 요청 횟수 초과
   * - rate limit 초과 (429)
   */
  RESEND_RATE_LIMIT_EXCEEDED: makeApiCode("resend", API_RESULTS.RATE_LIMITED),
} as const;

/**
 * AUTH_API_CODES에서 생성된 값들의 유니온 타입
 *
 * 사용 목적:
 * - API 응답의 code를 타입으로 강제
 * - 잘못된 문자열 사용 방지 (타입 안정성 확보)
 */
export type AuthApiCode = (typeof AUTH_API_CODES)[keyof typeof AUTH_API_CODES];
