import { useQueryClient } from "@tanstack/react-query";

import { ADMIN_AI_AGENTS_QUERY_KEY } from "../agents/constants/query-keys";
import { ADMIN_AI_MODELS_QUERY_KEY } from "../models/constants/query-keys";
import { ADMIN_AI_PROMPTS_QUERY_KEY } from "../prompts/constants/query-keys";
import {
  ADMIN_AI_SETTING_CONFIGURATIONS_QUERY_KEY,
  ADMIN_AI_SETTINGS_QUERY_KEY,
} from "../settings/constants/query-keys";

/**
 * 관리자 AI Query 캐시를 모두 무효화합니다.
 *
 * 서로 참조하는 AI 모델, Agent, Prompt, Setting 데이터가 mutation 이후
 * 일관된 상태로 다시 조회되도록 관련 Query invalidation 완료까지 기다립니다.
 *
 * @param queryClient TanStack Query client
 */
export async function invalidateAdminAiQueries(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<void> {
  // AI 관리 데이터는 서로 참조되므로 mutation 이후 관련 캐시를 함께 무효화한다.
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: ADMIN_AI_MODELS_QUERY_KEY.all,
    }),
    queryClient.invalidateQueries({
      queryKey: ADMIN_AI_AGENTS_QUERY_KEY.all,
    }),
    queryClient.invalidateQueries({
      queryKey: ADMIN_AI_PROMPTS_QUERY_KEY.all,
    }),
    queryClient.invalidateQueries({
      queryKey: ADMIN_AI_SETTINGS_QUERY_KEY.all,
    }),
    queryClient.invalidateQueries({
      queryKey: ADMIN_AI_SETTING_CONFIGURATIONS_QUERY_KEY.all,
    }),
  ]);
}
