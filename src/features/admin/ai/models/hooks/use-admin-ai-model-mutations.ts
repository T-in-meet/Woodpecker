import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateAdminAiQueries } from "../../utils/invalidate-admin-ai-queries";
import {
  createAdminAiModel,
  deleteAdminAiModel,
  updateAdminAiModel,
} from "../actions";

/**
 * AI 모델 생성 mutation 훅입니다.
 *
 * @returns 모델 생성 mutation
 */
export function useCreateAdminAiModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAdminAiModel,
    onSuccess: () => invalidateAdminAiQueries(queryClient),
  });
}

/**
 * AI 모델 수정 mutation 훅입니다.
 *
 * @returns 모델 수정 mutation
 */
export function useUpdateAdminAiModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAdminAiModel,
    onSuccess: () => invalidateAdminAiQueries(queryClient),
  });
}

/**
 * AI 모델 삭제 mutation 훅입니다.
 *
 * @returns 모델 삭제 mutation
 */
export function useDeleteAdminAiModel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAdminAiModel,
    onSuccess: () => invalidateAdminAiQueries(queryClient),
  });
}
