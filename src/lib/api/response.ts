import {
  type ApiCode,
  type ApiResult,
  RESULT_HTTP_STATUS_MAP,
} from "@/lib/constants/apiCodes";

import type { ValidationError } from "../validation/validation-error.types";

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
 * ApiCode → HTTP status 결정 규칙
 *
 * 우선순위:
 * 1. override (명시적 지정)
 * 2. ApiCode suffix 기반 자동 매핑 (RESULT_HTTP_STATUS_MAP)
 * 3. fallback: 500
 *
 * 현재 상태:
 * - 모든 API는 ApiCode suffix 기반 자동 매핑을 사용하고 있음
 * - status override의 실사용처는 존재하지 않음
 *
 * 설계 의도:
 * - 향후 resource 생성 API 등에서 201 등의 예외 status가 필요할 수 있어
 *   override 옵션을 유지함
 */

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
