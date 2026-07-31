import type { COMPONENT_PLAYGROUND_SEARCH_FIELDS } from "../constants/search";

/**
 * Component Playground 사용자 목록에서 검색 가능한 필드입니다.
 *
 * 검색 필드 상수의 `value`를 기준으로 자동으로 추론합니다.
 */
export type ComponentPlaygroundSearchField =
  (typeof COMPONENT_PLAYGROUND_SEARCH_FIELDS)[number]["value"];
