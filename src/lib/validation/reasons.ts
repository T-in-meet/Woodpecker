/**
 * 서버/클라이언트 공통 validation 에러 사유 상수
 *
 * 목적:
 * - validation 실패 원인을 문자열이 아닌 상수로 관리
 * - API ↔ 프론트 간 에러 계약 유지
 * - UI 메시지 매핑(mapReasonToMessage 등)에 사용
 *
 * 사용 흐름:
 * 1. validation에서 reason 생성
 * 2. API 응답으로 전달 (data.errors[].reason)
 * 3. 프론트에서 메시지로 변환하여 표시
 */
export const VALIDATION_REASON = {
  /**
   * 필수값 누락
   * - 값이 없거나 빈 문자열
   */
  REQUIRED: "REQUIRED",

  /**
   * 형식 오류
   * - 이메일 형식, 정규식 불일치 등
   */
  INVALID_FORMAT: "INVALID_FORMAT",

  /**
   * 최소 길이 미만
   * - password, nickname 등
   */
  TOO_SHORT: "TOO_SHORT",

  /**
   * 최대 길이 초과
   */
  TOO_LONG: "TOO_LONG",

  /**
   * 타입 불일치
   * - string이어야 하는데 number 등
   */
  INVALID_TYPE: "INVALID_TYPE",

  /**
   * 약관 미동의
   * - termsOfService / privacyPolicy
   */
  NOT_AGREED: "NOT_AGREED",
} as const;
