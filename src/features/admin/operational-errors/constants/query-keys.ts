import type { OperationalErrorListQuery } from "../types/operational-error-list";

export const ADMIN_OPERATIONAL_ERROR_QUERY_KEYS = {
  all: ["admin-operational-errors"] as const,

  lists: () => [...ADMIN_OPERATIONAL_ERROR_QUERY_KEYS.all, "list"] as const,

  list: (query: OperationalErrorListQuery) =>
    [...ADMIN_OPERATIONAL_ERROR_QUERY_KEYS.lists(), query] as const,

  details: () => [...ADMIN_OPERATIONAL_ERROR_QUERY_KEYS.all, "detail"] as const,

  detail: (operationalErrorId: string) =>
    [
      ...ADMIN_OPERATIONAL_ERROR_QUERY_KEYS.details(),
      operationalErrorId,
    ] as const,
};
