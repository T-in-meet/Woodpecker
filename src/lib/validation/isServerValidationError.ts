/**
 * 서버에서 내려오는 validation 에러 응답 타입
 *
 * 구조:
 * {
 *   success: false,
 *   code: string,
 *   data: {
 *     errors: [{ field, reason }]
 *   }
 * }
 *
 * - success: false → 실패 응답임을 명시
 * - code: 에러 종류 식별 (예: AUTH_INVALID_INPUT)
 * - data.errors:
 *    - field: 어떤 필드에서 발생했는지
 *    - reason: 에러 원인 (클라이언트 표시용 메시지 키/문구)
 */
type ServerValidationError = {
  success: false;
  code: string;
  data: {
    errors: Array<{ field: string; reason: string }>;
  };
};

/**
 * 서버 validation 에러인지 판별하는 타입 가드
 *
 * 사용 목적:
 * - unknown 에러를 안전하게 narrowing
 * - 서버 validation 에러일 경우 필드 에러 UI로 매핑 가능
 *
 * 예:
 * try {
 *   ...
 * } catch (e) {
 *   if (isServerValidationError(e)) {
 *     // e.data.errors 사용 가능 (타입 보장)
 *   }
 * }
 */
export function isServerValidationError(
  e: unknown,
): e is ServerValidationError {
  /**
   * 1. 객체인지 확인 (null 포함 방지)
   */
  if (typeof e !== "object" || e === null) return false;

  const obj = e as Record<string, unknown>;

  /**
   * 2. success === false 확인
   * - 실패 응답인지 체크
   */
  if (obj["success"] !== false) return false;

  /**
   * 3. 특정 에러 코드 확인
   * - _INVALID_INPUT로 끝나는 에러를 validation 에러로 간주
   */
  function isValidationCode(code: string): boolean {
    return code.endsWith("_INVALID_INPUT");
  }

  if (!isValidationCode(obj["code"] as string)) return false;

  /**
   * 4. data 객체 존재 여부 확인
   */
  if (typeof obj["data"] !== "object" || obj["data"] === null) return false;

  const data = obj["data"] as Record<string, unknown>;

  /**
   * 5. data.errors 배열 구조 검증
   * - 각 요소가 { field: string, reason: string } 형태인지 확인
   */
  return (
    Array.isArray(data["errors"]) &&
    (data["errors"] as unknown[]).every(
      (err) =>
        typeof err === "object" &&
        err !== null &&
        typeof (err as Record<string, unknown>)["field"] === "string" &&
        typeof (err as Record<string, unknown>)["reason"] === "string",
    )
  );
}
