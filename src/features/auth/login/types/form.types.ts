/**
 * login 폼에서 사용하는 필드 이름 목록
 *
 * 서버에서 내려오는 validation error의 field 값을
 * 폼 필드와 매핑할 때 기준으로 사용한다
 */
export const LOGIN_FIELD_NAMES = ["email", "password"] as const;

/**
 * login 폼 필드 이름의 유니온 타입
 *
 * resolveFieldName에 전달하는 validFieldSet의 타입 파라미터로 사용된다
 */
export type LoginFieldName = (typeof LOGIN_FIELD_NAMES)[number];
