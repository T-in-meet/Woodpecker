import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateAdminAiQueries } from "../../utils/invalidate-admin-ai-queries";
import {
  createAdminAiAgent,
  deleteAdminAiAgent,
  updateAdminAiAgent,
} from "../actions";

/**
 * AI Agent 생성 mutation 훅입니다.
 *
 * @returns Agent 생성 mutation
 */
export function useCreateAdminAiAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAdminAiAgent,
    onSuccess: () => invalidateAdminAiQueries(queryClient),
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
    onSuccess: () => invalidateAdminAiQueries(queryClient),
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
    onSuccess: () => invalidateAdminAiQueries(queryClient),
  });
}
