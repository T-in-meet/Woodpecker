import { VALIDATION_REASON } from "../constants/validation";

/**
 * ValidationReason 타입
 *
 * - VALIDATION_REASON 객체의 value들을 유니온 타입으로 변환
 *
 * 예:
 * VALIDATION_REASON = {
 *   REQUIRED: "REQUIRED",
 *   INVALID_FORMAT: "INVALID_FORMAT",
 *   ...
 * }
 *
 * → ValidationReason =
 *   | "REQUIRED"
 *   | "INVALID_FORMAT"
 *   | ...
 *
 * 사용 목적:
 * - validation reason을 문자열이 아닌 타입으로 강제
 * - 서버 ↔ 클라이언트 간 계약 일관성 유지
 * - mapReasonToMessage 등에서 타입 안전성 확보
 *
 * 장점:
 * - 새로운 reason 추가 시 자동으로 타입 확장
 * - 잘못된 문자열 사용 시 컴파일 단계에서 에러 발생
 */
export type ValidationReason =
  (typeof VALIDATION_REASON)[keyof typeof VALIDATION_REASON];
