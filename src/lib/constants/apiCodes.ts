export const API_RESULTS = {
  SUCCESS: "SUCCESS",
  INVALID_INPUT: "INVALID_INPUT",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  RATE_LIMITED: "RATE_LIMITED",
} as const;

export type ApiResult = (typeof API_RESULTS)[keyof typeof API_RESULTS];

/**
 * API 응답 code 패턴
 *
 * 기본 패턴:
 * - [DOMAIN]_[RESULT]
 *
 * 확장 패턴:
 * - [DOMAIN]_[ACTION]_[RESULT]
 */
export type ApiCode =
  | `${Uppercase<string>}_${ApiResult}`
  | `${Uppercase<string>}_${Uppercase<string>}_${ApiResult}`;

export const RESULT_HTTP_STATUS_MAP: Record<ApiResult, number> = {
  SUCCESS: 200,
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  RATE_LIMITED: 429,
} as const;

/**
 * [DOMAIN]_[RESULT]
 * 예:
 * - SIGNUP_SUCCESS
 * - PROFILE_NOT_FOUND
 */
export function makeApiCode<D extends string, R extends ApiResult>(
  domain: D,
  result: R,
): `${Uppercase<D>}_${R}` {
  return `${toCodeToken(domain)}_${result}` as `${Uppercase<D>}_${R}`;
}

/**
 * [DOMAIN]_[ACTION]_[RESULT]
 * 예:
 * - PROFILE_FETCH_SUCCESS
 * - PROFILE_UPDATE_INVALID_INPUT
 */
export function makeApiActionCode<
  D extends string,
  A extends string,
  R extends ApiResult,
>(domain: D, action: A, result: R): `${Uppercase<D>}_${Uppercase<A>}_${R}` {
  return `${toCodeToken(domain)}_${toCodeToken(action)}_${result}` as `${Uppercase<D>}_${Uppercase<A>}_${R}`;
}

function toCodeToken(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

/**
 * 성공/실패를 code로부터 판별할 때 사용할 수 있는 유틸.
 * 단, 비즈니스 로직 분기보다 테스트 보조 / 로깅 용도로 사용하는 편이 적절하다.
 */
export function isSuccessCode(code: string): boolean {
  return code.endsWith(`_${API_RESULTS.SUCCESS}`);
}

/**
 * code의 RESULT에 맞는 기본 HTTP Status를 반환한다.
 *
 * 주의:
 * - SUCCESS는 기본값으로 200을 반환한다.
 * - 리소스 생성 성공처럼 201이 필요한 경우에는 라우트에서 명시적으로 덮어써야 한다.
 */
export function getDefaultStatusFromCode(code: string): number | undefined {
  const results = Object.keys(RESULT_HTTP_STATUS_MAP) as ApiResult[];
  const result = results.find((r) => code.endsWith(`_${r}`));
  return result ? RESULT_HTTP_STATUS_MAP[result] : undefined;
}
