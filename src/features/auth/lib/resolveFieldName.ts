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
  // 1. direct field 매칭
  // 서버에서 내려온 field가 그대로 유효한 경우 즉시 반환한다
  // 예: "email" → "email"
  if (validFieldSet.has(field as FieldName)) {
    return field as FieldName;
  }

  // 2. dot path 분리
  // 예: "agreements.termsOfService" → ["agreements", "termsOfService"]
  const segments = field.split(".");

  // 3. 비정상 path 방어 (구조 검증)
  // - 선행, 중간, 후행에 빈 segment가 하나라도 있으면 invalid 처리
  // - 마지막 segment만 보고 판단하지 않고 path 자체가 정상이어야 함
  //
  // 차단 예:
  // ".email"
  // "a..email"
  // "email."
  // "..email"
  if (segments.some((segment) => segment === "")) {
    return null;
  }

  // 4. 마지막 segment 추출
  const lastSegment = segments[segments.length - 1];

  // 5. 마지막 segment 존재 검증
  // - 타입 안전을 위해 undefined 가능성을 제거한다
  if (!lastSegment) return null;

  // 6. 마지막 segment 유효성 검사
  // 공백만 있는 경우는 유효한 필드명이 아니므로 차단
  // 예: "a.b.   "
  if (lastSegment.trim() === "") {
    return null;
  }

  // 7. 마지막 segment 기준 매핑
  // validFieldSet에 포함된 경우에만 반환
  if (validFieldSet.has(lastSegment as FieldName)) {
    return lastSegment as FieldName;
  }

  // 8. 어떤 필드 집합에도 속하지 않는 경우 null 반환
  // → 폼에서 처리하지 않는 필드는 무시
  return null;
}
