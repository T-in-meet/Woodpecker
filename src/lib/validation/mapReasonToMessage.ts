/**
 * Validation reason → 사용자 표시 메시지 매핑 테이블
 *
 * 목적:
 * - 서버에서 전달된 reason을 UI 메시지로 변환
 * - 문자열 하드코딩 분산 방지 (중앙 관리)
 *
 * 예:
 * - REQUIRED → "필수 입력 항목입니다"
 * - INVALID_FORMAT → "올바른 형식을 입력해주세요"
 *
 * ⚠️ 주의사항:
 * - 서버의 VALIDATION_REASON과 반드시 동기화 필요
 * - 누락된 reason은 fallback 메시지로 처리됨
 */
const REASON_MESSAGES: Record<string, string> = {
  REQUIRED: "필수 입력 항목입니다",
  INVALID_FORMAT: "올바른 형식을 입력해주세요",
  TOO_SHORT: "입력 내용이 너무 짧습니다",
  TOO_LONG: "입력 내용이 너무 깁니다",
  NOT_AGREED: "동의가 필요합니다",

  /**
   * 일반적인 invalid 케이스 (fallback 성격)
   */
  INVALID: "올바르지 않은 입력입니다",

  /**
   * 중복 값 (예: 이메일 중복)
   */
  DUPLICATE: "이미 사용 중인 값입니다",
};

/**
 * reason → 사용자 메시지 변환 함수
 *
 * @param reason 서버에서 내려온 validation reason
 * @returns 사용자에게 표시할 메시지
 *
 * 동작:
 * - 매핑 테이블에서 메시지 조회
 * - 없으면 기본 fallback 메시지 반환
 */
export function mapReasonToMessage(reason: string): string {
  return REASON_MESSAGES[reason] ?? "올바르지 않은 입력입니다";
}
