import type { AdminPaginationConfig } from "@/features/admin/types/pagination";

/**
 * Component Playground 사용자 목록의 페이지네이션 설정입니다.
 */
export const COMPONENT_PLAYGROUND_PAGINATION = {
  pageSize: 10,
  pageCount: 5,
} as const satisfies AdminPaginationConfig;
