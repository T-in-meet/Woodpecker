import { useQueryClient } from "@tanstack/react-query";

import { ADMIN_AI_MODELS_QUERY_KEY } from "../models/constants/query-keys";

/**
 * 관리자 AI 모델 Query 캐시를 무효화합니다.
 *
 * @param queryClient TanStack Query client
 */
export async function invalidateAdminAiQueries(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: ADMIN_AI_MODELS_QUERY_KEY.all,
  });
}
