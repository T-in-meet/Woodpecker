import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateAdminAiQueries } from "../../utils/invalidate-admin-ai-queries";
import {
  archiveAdminAiPromptVersion,
  createAdminAiPromptVersion,
  deleteAdminAiPromptVersion,
  publishAdminAiPromptVersion,
  updateAdminAiPromptVersion,
} from "../actions";

/**
 * AI prompt version 생성 mutation 훅입니다.
 *
 * @returns prompt version 생성 mutation
 */
export function useCreateAdminAiPromptVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAdminAiPromptVersion,
    onSuccess: () => invalidateAdminAiQueries(queryClient),
  });
}

/**
 * AI prompt version 수정 mutation 훅입니다.
 *
 * @returns prompt version 수정 mutation
 */
export function useUpdateAdminAiPromptVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAdminAiPromptVersion,
    onSuccess: () => invalidateAdminAiQueries(queryClient),
  });
}

/**
 * AI prompt version publish mutation 훅입니다.
 *
 * @returns prompt version publish mutation
 */
export function usePublishAdminAiPromptVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: publishAdminAiPromptVersion,
    onSuccess: () => invalidateAdminAiQueries(queryClient),
  });
}

/**
 * AI prompt version archive mutation 훅입니다.
 *
 * @returns prompt version archive mutation
 */
export function useArchiveAdminAiPromptVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveAdminAiPromptVersion,
    onSuccess: () => invalidateAdminAiQueries(queryClient),
  });
}

/**
 * AI prompt version 삭제 mutation 훅입니다.
 *
 * @returns prompt version 삭제 mutation
 */
export function useDeleteAdminAiPromptVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      familyId,
      versionId,
    }: {
      familyId: string;
      versionId: string;
    }) => deleteAdminAiPromptVersion(familyId, versionId),
    onSuccess: () => invalidateAdminAiQueries(queryClient),
  });
}
