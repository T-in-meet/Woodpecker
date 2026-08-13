import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateAdminAiQueries } from "../../utils/invalidate-admin-ai-queries";
import {
  createAdminAiPromptFamily,
  deleteAdminAiPromptFamily,
  updateAdminAiPromptFamily,
} from "../actions";

/**
 * AI prompt family 생성 mutation 훅입니다.
 *
 * @returns prompt family 생성 mutation
 */
export function useCreateAdminAiPromptFamily() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAdminAiPromptFamily,
    onSuccess: () => invalidateAdminAiQueries(queryClient),
  });
}

/**
 * AI prompt family 수정 mutation 훅입니다.
 *
 * @returns prompt family 수정 mutation
 */
export function useUpdateAdminAiPromptFamily() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAdminAiPromptFamily,
    onSuccess: () => invalidateAdminAiQueries(queryClient),
  });
}

/**
 * AI prompt family 삭제 mutation 훅입니다.
 *
 * @returns prompt family 삭제 mutation
 */
export function useDeleteAdminAiPromptFamily() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAdminAiPromptFamily,
    onSuccess: () => invalidateAdminAiQueries(queryClient),
  });
}
