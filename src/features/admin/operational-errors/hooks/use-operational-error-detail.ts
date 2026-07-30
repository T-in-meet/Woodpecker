import { useQuery } from "@tanstack/react-query";

import { ADMIN_OPERATIONAL_ERROR_QUERY_KEYS } from "../constants/query-keys";
import { getOperationalErrorDetail } from "../queries";

export function useOperationalErrorDetail(operationalErrorId: string) {
  return useQuery({
    queryFn: () => getOperationalErrorDetail(operationalErrorId),
    queryKey: ADMIN_OPERATIONAL_ERROR_QUERY_KEYS.detail(operationalErrorId),
  });
}
