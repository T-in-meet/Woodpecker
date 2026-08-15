import { useMutation, useQueryClient } from "@tanstack/react-query";

import { invalidateAdminAiQueriesOnSuccessfulResult } from "../../utils/invalidate-admin-ai-queries-on-successful-result";
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
    onSuccess: (result) =>
      invalidateAdminAiQueriesOnSuccessfulResult(queryClient, result),
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
    onSuccess: (result) =>
      invalidateAdminAiQueriesOnSuccessfulResult(queryClient, result),
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
    onSuccess: (result) =>
      invalidateAdminAiQueriesOnSuccessfulResult(queryClient, result),
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
    onSuccess: (result) =>
      invalidateAdminAiQueriesOnSuccessfulResult(queryClient, result),
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
    onSuccess: (result) =>
      invalidateAdminAiQueriesOnSuccessfulResult(queryClient, result),
  });
}
