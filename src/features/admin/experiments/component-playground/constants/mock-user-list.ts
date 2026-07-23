import type { AdminListConfig } from "@/features/admin/types/list";

import type { ComponentPlaygroundFilterField } from "../types/filter";
import type { ComponentPlaygroundSearchField } from "../types/search";
import { COMPONENT_PLAYGROUND_FILTERS } from "./filter";
import { COMPONENT_PLAYGROUND_PAGINATION } from "./pagination";
import { COMPONENT_PLAYGROUND_SEARCH_FIELDS } from "./search";

/**
 * Component Playground 사용자 목록에서 사용하는 설정입니다.
 *
 * 검색 필드, 필터 정의, 페이지네이션 설정을 하나로 묶어
 * 목록 페이지와 공통 Hook에서 동일한 설정을 사용합니다.
 */
export const COMPONENT_PLAYGROUND_LIST_CONFIG = {
  search: {
    initialField: "name",
    fields: COMPONENT_PLAYGROUND_SEARCH_FIELDS,
  },

  filters: COMPONENT_PLAYGROUND_FILTERS,

  pagination: COMPONENT_PLAYGROUND_PAGINATION,
} as const satisfies AdminListConfig<
  ComponentPlaygroundSearchField,
  ComponentPlaygroundFilterField
>;
