"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ADMIN_UNKNOWN_ERROR_MESSAGE } from "@/features/admin/ai/constants/errors";

import type { AdminAiActionResult } from "../../types";
import {
  useArchiveAdminAiPromptVersion,
  useDeleteAdminAiPromptVersion,
  usePublishAdminAiPromptVersion,
} from "./use-admin-ai-prompt-version-mutations";

type UseAdminAiPromptVersionLifecycleActionsOptions = {
  /** Prompt Version이 속한 Family ID입니다. */
  familyId: string;

  /** 삭제 성공 후 기본 refresh 대신 실행할 후속 작업입니다. */
  onDeleteSuccess?: () => void;
};

type LifecycleActionConfig = {
  /** Mutation 실행 함수입니다. */
  mutate: (versionId: string) => Promise<AdminAiActionResult>;

  /** 성공 시 표시할 toast 메시지입니다. */
  successMessage: string;
};

/**
 * Prompt Version lifecycle 변경 결과를 공통으로 처리합니다.
 *
 * 실패 결과는 화면 메시지로 표시하고, 성공 결과는 toast와 refresh를 실행합니다.
 * 예상하지 못한 오류는 공통 알 수 없는 오류 toast로 표시합니다.
 *
 * @param options Prompt Version lifecycle 작업 옵션
 * @returns Prompt Version lifecycle 작업 상태와 핸들러
 */
export function useAdminAiPromptVersionLifecycleActions({
  familyId,
  onDeleteSuccess,
}: UseAdminAiPromptVersionLifecycleActionsOptions) {
  const router = useRouter();
  const publishMutation = usePublishAdminAiPromptVersion();
  const archiveMutation = useArchiveAdminAiPromptVersion();
  const deleteMutation = useDeleteAdminAiPromptVersion();

  const [message, setMessage] = useState<string | null>(null);

  /**
   * publish/archive 공통 mutation 실행 흐름입니다.
   *
   * @param versionId 작업 대상 Prompt Version ID
   * @param config mutation 실행 설정
   */
  async function runRefreshingAction(
    versionId: string,
    config: LifecycleActionConfig,
  ) {
    setMessage(null);

    try {
      const result = await config.mutate(versionId);

      if (!result.ok) {
        setMessage(result.message ?? "처리하지 못했습니다.");
        return;
      }

      setMessage(null);
      toast.success(config.successMessage);
      router.refresh();
    } catch {
      toast.error(ADMIN_UNKNOWN_ERROR_MESSAGE);
    }
  }

  /**
   * Draft 또는 Archived Prompt Version을 Published 상태로 전환합니다.
   *
   * @param versionId 작업 대상 Prompt Version ID
   */
  async function handlePublishVersion(versionId: string) {
    await runRefreshingAction(versionId, {
      mutate: publishMutation.mutateAsync,
      successMessage: "AI Prompt Version을 Publish했습니다.",
    });
  }

  /**
   * Published Prompt Version을 Archived 상태로 전환합니다.
   *
   * @param versionId 작업 대상 Prompt Version ID
   */
  async function handleArchiveVersion(versionId: string) {
    await runRefreshingAction(versionId, {
      mutate: archiveMutation.mutateAsync,
      successMessage: "AI Prompt Version을 Archive했습니다.",
    });
  }

  /**
   * 삭제 가능한 Prompt Version을 삭제합니다.
   *
   * @param versionId 작업 대상 Prompt Version ID
   */
  async function handleDeleteVersion(versionId: string) {
    setMessage(null);

    try {
      const result = await deleteMutation.mutateAsync({
        familyId,
        versionId,
      });

      if (!result.ok) {
        setMessage(result.message ?? "처리하지 못했습니다.");
        return;
      }

      setMessage(null);
      toast.success("AI Prompt Version을 삭제했습니다.");

      if (onDeleteSuccess) {
        onDeleteSuccess();
        return;
      }

      router.refresh();
    } catch {
      toast.error(ADMIN_UNKNOWN_ERROR_MESSAGE);
    }
  }

  return {
    deletePending: deleteMutation.isPending,
    handleArchiveVersion,
    handleDeleteVersion,
    handlePublishVersion,
    message,
    pending: publishMutation.isPending || archiveMutation.isPending,
    setMessage,
  };
}
