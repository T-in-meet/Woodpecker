import { useQuery } from "@tanstack/react-query";

import { ADMIN_OPERATIONAL_ERROR_QUERY_KEYS } from "../constants/query-keys";
import { getOperationalErrors } from "../queries";
import type { OperationalErrorListQuery } from "../types/operational-error-list";

export function useOperationalErrors(query: OperationalErrorListQuery) {
  return useQuery({
    placeholderData: (previousData) => previousData,
    queryFn: () => getOperationalErrors(query),
    queryKey: ADMIN_OPERATIONAL_ERROR_QUERY_KEYS.list(query),
  });
}
