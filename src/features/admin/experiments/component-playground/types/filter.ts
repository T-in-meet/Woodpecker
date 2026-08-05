import type { AdminAppliedFilter } from "@/features/admin/types/filter";

import { COMPONENT_PLAYGROUND_FILTERS } from "../constants/filter";

/**
 * Component Playground 사용자 목록에서 사용할 수 있는 필터 필드입니다.
 *
 * 필터 정의 상수의 `field`를 기준으로 자동으로 추론합니다.
 */
export type ComponentPlaygroundFilterField =
  (typeof COMPONENT_PLAYGROUND_FILTERS)[number]["field"];

/**
 * Component Playground 사용자 목록에 실제로 적용된 필터 모음입니다.
 */
export type ComponentPlaygroundFilters = Partial<
  Record<
    ComponentPlaygroundFilterField,
    AdminAppliedFilter<ComponentPlaygroundFilterField>
  >
>;
