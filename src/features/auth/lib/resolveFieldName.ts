import {
  SIGNUP_FIELD_NAMES,
  type SignupFieldName,
} from "../signup/types/form.types";

/**
 * 폼에서 사용하는 유효한 필드 이름 집합
 *
 * - 서버에서 내려오는 field 값이 이 집합에 포함되어야
 *   클라이언트 폼 필드와 매핑 가능
 *
 * 예:
 * - "email"
 * - "agreements.termsOfService" → "termsOfService"로 변환 후 매핑
 */
const SIGNUP_FIELD_NAME_SET = new Set(SIGNUP_FIELD_NAMES);

/**
 * 서버 validation error의 field 값을
 * signup 폼에서 처리 가능한 필드명으로 매핑한다.
 *
 * @param serverField 서버에서 내려온 field (예: "email", "agreements.termsOfService")
 * @returns SignupFieldName 또는 null
 *
 * 사용 목적:
 * - 서버 에러 → react-hook-form setError로 연결하기 위함
 */
export function resolveFieldName(serverField: string): SignupFieldName | null {
  /**
   * 1. 서버 필드가 그대로 일치하는 경우
   * 예: "email"
   */
  if (SIGNUP_FIELD_NAME_SET.has(serverField as SignupFieldName)) {
    return serverField as SignupFieldName;
  }

  /**
   * 2. 중첩 필드 처리
   * 예: "agreements.termsOfService" → "termsOfService"
   */
  const lastSegment = serverField.split(".").at(-1) ?? "";

  if (SIGNUP_FIELD_NAME_SET.has(lastSegment as SignupFieldName)) {
    return lastSegment as SignupFieldName;
  }

  /**
   * 3. 매핑 불가
   * - 폼에서 처리하지 않는 필드
   */
  return null;
}
