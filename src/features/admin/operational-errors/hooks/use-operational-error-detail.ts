import { useQuery } from "@tanstack/react-query";

import { getOperationalErrorDetail } from "../queries";

export const ADMIN_OPERATIONAL_ERROR_DETAIL_QUERY_KEY = {
  all: ["admin-operational-error-detail"] as const,

  detail: (operationalErrorId: string) =>
    [
      ...ADMIN_OPERATIONAL_ERROR_DETAIL_QUERY_KEY.all,
      operationalErrorId,
    ] as const,
};

export function useOperationalErrorDetail(operationalErrorId: string) {
  return useQuery({
    queryFn: () => getOperationalErrorDetail(operationalErrorId),
    queryKey:
      ADMIN_OPERATIONAL_ERROR_DETAIL_QUERY_KEY.detail(operationalErrorId),
  });
}
