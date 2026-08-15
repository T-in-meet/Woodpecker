import { useQueryClient } from "@tanstack/react-query";

import { ADMIN_AI_AGENTS_QUERY_KEY } from "../agents/constants/query-keys";
import { ADMIN_AI_MODELS_QUERY_KEY } from "../models/constants/query-keys";

/**
 * 관리자 AI 모델 및 Agent Query 캐시를 무효화합니다.
 *
 * @param queryClient TanStack Query client
 */
export async function invalidateAdminAiQueries(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ADMIN_AI_MODELS_QUERY_KEY.all,
    }),
    queryClient.invalidateQueries({
      queryKey: ADMIN_AI_AGENTS_QUERY_KEY.all,
    }),
  ]);
}
