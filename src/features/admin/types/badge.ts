/**
 * 관리자 배지에서 사용할 색상입니다.
 */
export type AdminBadgeColor =
  | "gray"
  | "blue"
  | "green"
  | "yellow"
  | "red"
  | "purple";

/**
 * 관리자 배지 하나의 표시 설정입니다.
 */
export interface AdminBadgeDefinition {
  /** 배지에 표시할 문구 */
  label: string;

  /** 배지에 적용할 색상 */
  color: AdminBadgeColor;
}

/**
 * 특정 값별 관리자 배지 설정입니다.
 *
 * @template TValue 배지로 표현할 문자열 리터럴 타입
 */
export type AdminBadgeConfig<TValue extends string> = Record<
  TValue,
  AdminBadgeDefinition
>;
