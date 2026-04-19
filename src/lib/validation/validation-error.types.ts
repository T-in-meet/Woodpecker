import { ValidationReason } from "./validation.types";

/**
 * Validation 에러 구조
 *
 * - field: 에러가 발생한 필드
 * - reason: 에러 원인 (도메인 상수)
 */
export type ValidationError = {
  field: string;
  reason: ValidationReason;
};
