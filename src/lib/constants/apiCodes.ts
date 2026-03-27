export const API_RESULTS = {
  SUCCESS: "SUCCESS",
  INVALID_INPUT: "INVALID_INPUT",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
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
} as const;

/**
 * [DOMAIN]_[RESULT]
 * 예:
 * - SIGNUP_SUCCESS
 * - PROFILE_NOT_FOUND
 */
export function makeApiCode(domain: string, result: ApiResult): ApiCode {
  return `${toCodeToken(domain)}_${result}` as ApiCode;
}

/**
 * [DOMAIN]_[ACTION]_[RESULT]
 * 예:
 * - PROFILE_FETCH_SUCCESS
 * - PROFILE_UPDATE_INVALID_INPUT
 */
export function makeApiActionCode(
  domain: string,
  action: string,
  result: ApiResult,
): ApiCode {
  return `${toCodeToken(domain)}_${toCodeToken(action)}_${result}` as ApiCode;
}

function toCodeToken(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

/**
 * 현재 프로젝트에서 바로 사용할 수 있는 공통/대표 코드
 *
 * 필요 시 도메인별 파일로 분리 가능:
 * - authApiCodes.ts
 * - profileApiCodes.ts
 * - noteApiCodes.ts
 */
export const API_CODES = {
  // Auth
  SIGNUP_SUCCESS: makeApiCode("signup", API_RESULTS.SUCCESS),
  SIGNUP_INVALID_INPUT: makeApiCode("signup", API_RESULTS.INVALID_INPUT),
  SIGNUP_UNAUTHORIZED: makeApiCode("signup", API_RESULTS.UNAUTHORIZED),
  SIGNUP_CONFLICT: makeApiCode("signup", API_RESULTS.CONFLICT),
  SIGNUP_INTERNAL_ERROR: makeApiCode("signup", API_RESULTS.INTERNAL_ERROR),

  LOGIN_SUCCESS: makeApiCode("login", API_RESULTS.SUCCESS),
  LOGIN_INVALID_INPUT: makeApiCode("login", API_RESULTS.INVALID_INPUT),
  LOGIN_UNAUTHORIZED: makeApiCode("login", API_RESULTS.UNAUTHORIZED),
  LOGIN_INTERNAL_ERROR: makeApiCode("login", API_RESULTS.INTERNAL_ERROR),

  // Profile
  PROFILE_FETCH_SUCCESS: makeApiActionCode(
    "profile",
    "fetch",
    API_RESULTS.SUCCESS,
  ),
  PROFILE_FETCH_NOT_FOUND: makeApiActionCode(
    "profile",
    "fetch",
    API_RESULTS.NOT_FOUND,
  ),
  PROFILE_UPDATE_SUCCESS: makeApiActionCode(
    "profile",
    "update",
    API_RESULTS.SUCCESS,
  ),
  PROFILE_UPDATE_INVALID_INPUT: makeApiActionCode(
    "profile",
    "update",
    API_RESULTS.INVALID_INPUT,
  ),
  PROFILE_UPDATE_FORBIDDEN: makeApiActionCode(
    "profile",
    "update",
    API_RESULTS.FORBIDDEN,
  ),
  PROFILE_UPDATE_INTERNAL_ERROR: makeApiActionCode(
    "profile",
    "update",
    API_RESULTS.INTERNAL_ERROR,
  ),
} as const;

export type PredefinedApiCode = (typeof API_CODES)[keyof typeof API_CODES];

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
  const result = code.split("_").at(-1) as ApiResult | undefined;

  if (!result) {
    return undefined;
  }

  return RESULT_HTTP_STATUS_MAP[result];
}
