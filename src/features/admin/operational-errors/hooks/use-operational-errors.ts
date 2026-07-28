import { useQuery } from "@tanstack/react-query";

import { getOperationalErrors } from "../queries";
import type { OperationalErrorListQuery } from "../types/operational-error-list";

export const ADMIN_OPERATIONAL_ERRORS_QUERY_KEY = {
  all: ["admin-operational-errors"] as const,

  list: (query: OperationalErrorListQuery) =>
    [...ADMIN_OPERATIONAL_ERRORS_QUERY_KEY.all, "list", query] as const,
};

export function useOperationalErrors(query: OperationalErrorListQuery) {
  return useQuery({
    placeholderData: (previousData) => previousData,
    queryFn: () => getOperationalErrors(query),
    queryKey: ADMIN_OPERATIONAL_ERRORS_QUERY_KEY.list(query),
  });
}
