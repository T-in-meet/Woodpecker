import { ADMIN_SORT_DIRECTION } from "@/features/admin/constants/admin-sort";
import type { AdminListConfig } from "@/features/admin/types/list";
import { AdminSort } from "@/features/admin/types/sort";

import type { ComponentPlaygroundFilterField } from "../types/filter";
import type { ComponentPlaygroundSearchField } from "../types/search";
import type { ComponentPlaygroundSortField } from "../types/sort";
import { COMPONENT_PLAYGROUND_FILTERS } from "./filter";
import { COMPONENT_PLAYGROUND_PAGINATION } from "./pagination";
import { COMPONENT_PLAYGROUND_SEARCH_FIELDS } from "./search";

/**
 * Component Playground 사용자 목록의 초기 정렬 조건입니다.
 *
 * 구체적인 초기 필드는 createdAt이지만, 이후 사용자가 선택할 수 있는
 * 전체 정렬 필드 타입을 유지하도록 명시합니다.
 */
const COMPONENT_PLAYGROUND_INITIAL_SORT: AdminSort<ComponentPlaygroundSortField> =
  {
    field: "createdAt",
    direction: ADMIN_SORT_DIRECTION.DESC,
  };

/**
 * Component Playground 사용자 목록에서 사용하는 설정입니다.
 *
 * 검색 필드, 필터 정의, 초기 정렬 조건, 페이지네이션 설정을 하나로 묶어
 * 목록 페이지와 공통 Hook에서 동일한 설정을 사용합니다.
 */
export const COMPONENT_PLAYGROUND_LIST_CONFIG = {
  search: {
    initialField: "name",
    fields: COMPONENT_PLAYGROUND_SEARCH_FIELDS,
  },

  filters: COMPONENT_PLAYGROUND_FILTERS,

  initialSort: COMPONENT_PLAYGROUND_INITIAL_SORT,

  pagination: COMPONENT_PLAYGROUND_PAGINATION,
} as const satisfies AdminListConfig<
  ComponentPlaygroundSearchField,
  ComponentPlaygroundFilterField,
  ComponentPlaygroundSortField
>;
