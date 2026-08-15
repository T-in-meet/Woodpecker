import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AdminAiActionResult } from "../../types";
import { invalidateAdminAiQueries } from "../../utils/invalidate-admin-ai-queries";
import {
  createAdminAiAgent,
  deleteAdminAiAgent,
  updateAdminAiAgent,
} from "../actions";

/**
 * 성공한 mutation 결과에 대해서만 관리자 AI Query 캐시를 무효화합니다.
 *
 * Server Action은 업무 실패를 throw하지 않고 ok: false로 resolve하므로
 * React Query onSuccess 안에서 결과 계약을 다시 확인해야 합니다.
 *
 * @param queryClient TanStack Query client
 * @param result Agent mutation 결과
 */
function invalidateAdminAiQueriesOnSuccessfulResult(
  queryClient: ReturnType<typeof useQueryClient>,
  result: AdminAiActionResult,
) {
  if (!result.ok) {
    return undefined;
  }

  return invalidateAdminAiQueries(queryClient);
}

/**
 * AI Agent 생성 mutation 훅입니다.
 *
 * @returns Agent 생성 mutation
 */
export function useCreateAdminAiAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAdminAiAgent,
    onSuccess: (result) =>
      invalidateAdminAiQueriesOnSuccessfulResult(queryClient, result),
  });
}

/**
 * AI Agent 수정 mutation 훅입니다.
 *
 * @returns Agent 수정 mutation
 */
export function useUpdateAdminAiAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAdminAiAgent,
    onSuccess: (result) =>
      invalidateAdminAiQueriesOnSuccessfulResult(queryClient, result),
  });
}

/**
 * AI Agent 삭제 mutation 훅입니다.
 *
 * @returns Agent 삭제 mutation
 */
export function useDeleteAdminAiAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAdminAiAgent,
    onSuccess: (result) =>
      invalidateAdminAiQueriesOnSuccessfulResult(queryClient, result),
  });
}
