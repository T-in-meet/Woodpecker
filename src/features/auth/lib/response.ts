import {
  type ApiCode,
  type ApiResult,
  RESULT_HTTP_STATUS_MAP,
} from "@/lib/constants/apiCodes";

import { ValidationReason } from "../../../lib/validation/validation.types";

/**
 * 성공 응답 타입
 *
 * - success: true
 * - code: API 코드 (도메인 + 결과)
 * - data: 실제 응답 데이터
 * - message: 선택적 메시지 (UI 표시용, 로직 판단 금지)
 */
type SuccessResponse<T> = {
  success: true;
  code: ApiCode;
  data: T;
  message?: string;
};

/**
 * 실패 응답 타입
 *
 * - success: false
 * - code: API 코드
 * - data:
 *    - null: 일반 실패
 *    - { errors }: validation 에러
 * - message: 선택적 메시지
 */
type FailureResponse = {
  success: false;
  code: ApiCode;
  data: null | { errors: ValidationError[] };
  message?: string;
};

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

/**
 * ApiCode에서 ApiResult 추출
 *
 * 예:
 * - "SIGNUP_SUCCESS" → "SUCCESS"
 * - "LOGIN_INVALID_INPUT" → "INVALID_INPUT"
 *
 * - 코드 suffix 기반으로 판단
 */
function getResultFromCode(code: string): ApiResult | undefined {
  const results = Object.keys(RESULT_HTTP_STATUS_MAP) as ApiResult[];

  return results.find((result) => code.endsWith(`_${result}`));
}

/**
 * ApiCode → HTTP status 변환
 *
 * 우선순위:
 * 1. override (명시적 지정)
 * 2. code 기반 자동 매핑
 * 3. fallback: 500
 */
function getStatusFromCode(code: ApiCode, override?: number): number {
  if (override !== undefined) return override;

  const result = getResultFromCode(code);

  return result ? (RESULT_HTTP_STATUS_MAP[result] ?? 500) : 500;
}

/**
 * 성공 응답 생성 헬퍼
 *
 * 사용 목적:
 * - 모든 API 응답 구조를 일관되게 유지
 * - 직접 Response.json 사용 금지 → 반드시 이 함수 사용
 *
 * @param code API 코드 (예: SIGNUP_SUCCESS)
 * @param data 응답 데이터
 * @param options status/message override
 */
export function successResponse<T>(
  code: ApiCode,
  data: T,
  options?: { status?: number; message?: string },
): Response {
  const body: SuccessResponse<T> = {
    success: true,
    code,
    data,
    ...(options?.message ? { message: options.message } : {}),
  };

  return Response.json(body, {
    status: options?.status ?? getStatusFromCode(code),
  });
}

/**
 * 실패 응답 생성 헬퍼
 *
 * 사용 목적:
 * - validation 에러 및 일반 에러를 동일한 구조로 반환
 *
 * @param code API 코드
 * @param options
 *  - errors: validation 에러 배열
 *  - status: HTTP status override
 *  - message: UI 표시용 메시지
 */
export function failureResponse(
  code: ApiCode,
  options?: {
    errors?: ValidationError[];
    status?: number;
    message?: string;
  },
): Response {
  const body: FailureResponse = {
    success: false,
    code,
    data: options?.errors ? { errors: options.errors } : null,
    ...(options?.message ? { message: options.message } : {}),
  };

  return Response.json(body, {
    status: options?.status ?? getStatusFromCode(code),
  });
}
