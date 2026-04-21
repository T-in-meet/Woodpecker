/**
 * auth 도메인 전반에서 사용하는 서버 validation error 필드 매핑 유틸
 *
 * 역할:
 * - 서버에서 내려오는 validation error의 field 값을
 *   폼에서 처리 가능한 필드명으로 변환한다
 * - 각 폼(signup, login 등)이 자신의 필드 집합을 주입함으로써
 *   단일 구현으로 여러 폼을 지원한다
 *
 * spec 근거: auth-shared-spec.md §3.7 Field Mapping
 */

// signup / login 필드 이름 상수를 이 파일에서 re-export하여
// 테스트와 호출부가 하나의 경로에서 import할 수 있도록 한다
export { LOGIN_FIELD_NAMES } from "@/features/auth/login/types/form.types";
export { SIGNUP_FIELD_NAMES } from "@/features/auth/signup/types/form.types";

/**
 * 서버 validation error의 field 값을 폼 필드명으로 매핑한다
 *
 * 동작 순서:
 * 1. 서버 field 값이 validFieldSet에 직접 일치하면 반환
 * 2. 중첩 경로(예: "agreements.termsOfService")는 마지막 segment를 추출해 매핑 시도
 * 3. 일치하는 필드가 없으면 null 반환
 *
 * generic 설계 이유:
 * - signup, login 등 각 폼이 자신의 필드 집합을 주입하므로
 *   타입 안전성을 유지하면서 재사용할 수 있다
 *
 * @param field - 서버에서 내려온 field 값 (예: "email", "agreements.termsOfService")
 * @param validFieldSet - 현재 폼에서 처리 가능한 필드 이름 집합
 * @returns 폼에서 처리 가능한 필드명, 또는 null (처리 불가 시)
 */
export function resolveFieldName<FieldName extends string>(
  field: string,
  validFieldSet: ReadonlySet<FieldName>,
): FieldName | null {
  // 서버 field가 유효한 필드 집합에 그대로 일치하는 경우
  // 예: "email" → "email"
  if (validFieldSet.has(field as FieldName)) {
    return field as FieldName;
  }

  // 중첩 필드 처리 — 서버가 객체 경로 형태로 내려줄 때 마지막 segment만 추출
  // 예: "agreements.termsOfService" → "termsOfService"
  const lastSegment = field.split(".").at(-1) ?? "";

  if (validFieldSet.has(lastSegment as FieldName)) {
    return lastSegment as FieldName;
  }

  // 어떤 필드 집합에도 해당하지 않으면 null 반환
  // 폼에서 처리하지 않는 필드는 무시한다
  return null;
}
