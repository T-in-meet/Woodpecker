import type { AdminSearchField } from "@/features/admin/types/search";

/**
 * Component Playground 사용자 목록에서 선택할 수 있는 검색 필드입니다.
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
] as const satisfies readonly AdminSearchField<string>[];

/**
 * Component Playground 사용자 목록에서 최초로 선택할 검색 필드입니다.
 */
export const COMPONENT_PLAYGROUND_INITIAL_SEARCH_FIELD = "name" as const;
