/**
 * login 폼에서 허용하는 필드 이름 목록
 *
 * 서버 validation error의 field 값을
 * 로그인 폼 필드에 매핑할 때 기준으로 사용한다.
 */
export const LOGIN_FIELD_NAMES = ["email", "password"] as const;

/**
 * login 폼에서 허용하는 필드 이름 유니온 타입
 *
 * LOGIN_FIELD_NAMES로부터 파생되며,
 * 필드 이름을 타입 수준에서 제한하는 데 사용한다.
 */
export type LoginFieldName = (typeof LOGIN_FIELD_NAMES)[number];

/**
 * login 폼 필드 집합
 *
 * resolveFieldName에 전달하여
 * 서버 validation error의 field 값을
 * 로그인 폼 필드로 매핑할 때 사용한다.
 */
export const LOGIN_FIELD_SET = new Set<LoginFieldName>(LOGIN_FIELD_NAMES);
