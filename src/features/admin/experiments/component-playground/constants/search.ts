/**
 * Component Playground에서 사용할 사용자 검색 필드 목록입니다.
 *
 * 실제 관리자 사용자 목록에서 검색 가능한 필드를 가정하여
 * 이름과 이메일 필드를 제공합니다.
 */
export const COMPONENT_PLAYGROUND_SEARCH_FIELDS = [
  {
    value: "name",
    label: "이름",
  },
  {
    value: "email",
    label: "이메일",
  },
] as const;

/**
 * Component Playground에서 사용할 검색 필드 타입입니다.
 */
export type ComponentPlaygroundSearchField =
  (typeof COMPONENT_PLAYGROUND_SEARCH_FIELDS)[number]["value"];
