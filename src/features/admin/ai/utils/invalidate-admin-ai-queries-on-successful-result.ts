import type { QueryClient } from "@tanstack/react-query";

import type { AdminAiActionResult } from "../types";
import { invalidateAdminAiQueries } from "./invalidate-admin-ai-queries";

/**
 * 성공한 관리자 AI mutation 결과에 대해서만 Query 캐시를 무효화합니다.
 *
 * Server Action은 업무 실패를 throw하지 않고 ok: false로 resolve하므로
 * React Query onSuccess 안에서 결과 계약을 다시 확인해야 합니다.
 *
 * @param queryClient TanStack Query client
 * @param result 관리자 AI mutation 결과
 * @returns Query 무효화 Promise 또는 실패 결과에서의 undefined
 */
export function invalidateAdminAiQueriesOnSuccessfulResult(
  queryClient: QueryClient,
  result: AdminAiActionResult,
) {
  if (!result.ok) {
    return undefined;
  }

  return invalidateAdminAiQueries(queryClient);
}
