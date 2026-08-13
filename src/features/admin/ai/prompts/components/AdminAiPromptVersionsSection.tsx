"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ADMIN_UNKNOWN_ERROR_MESSAGE } from "@/features/admin/ai/constants/errors";

import { AdminActionMessage } from "../../components/AdminActionMessage";
import {
  useArchiveAdminAiPromptVersion,
  useDeleteAdminAiPromptVersion,
  usePublishAdminAiPromptVersion,
} from "../hooks/use-admin-ai-prompt-version-mutations";
import type { AdminAiPromptFamilyDetail } from "../types";
import { AdminAiPromptVersionsTable } from "./AdminAiPromptVersionsTable";

type AdminAiPromptVersionsSectionProps = {
  /** Version 목록을 표시할 Prompt Family입니다. */
  family: AdminAiPromptFamilyDetail;
};

/**
 * Prompt Family의 Version 목록과 상태 변경을 관리합니다.
 *
 * @param props 컴포넌트 속성
 * @returns Prompt Version 관리 영역
 */
export function AdminAiPromptVersionsSection({
  family,
}: AdminAiPromptVersionsSectionProps) {
  const router = useRouter();
  const publishMutation = usePublishAdminAiPromptVersion();
  const archiveMutation = useArchiveAdminAiPromptVersion();
  const deleteMutation = useDeleteAdminAiPromptVersion();

  const [message, setMessage] = useState<string | null>(null);

  /**
   * Version 상태 변경 결과를 처리합니다.
   *
   * @param result 상태 변경 Mutation 결과
   * @param successMessage 성공 시 표시할 메시지
   */
  function handleVersionActionResult(
    result: {
      message?: string;
      ok: boolean;
    },
    successMessage: string,
  ) {
    if (!result.ok) {
      setMessage(result.message ?? "처리하지 못했습니다.");
      return;
    }

    setMessage(null);
    toast.success(successMessage);
    router.refresh();
  }

  /**
   * 예상하지 못한 Version 상태 변경 오류를 처리합니다.
   */
  function handleVersionActionError() {
    toast.error(ADMIN_UNKNOWN_ERROR_MESSAGE);
  }

  /**
   * Draft 또는 Archived Version을 Publish합니다.
   *
   * @param versionId Version ID
   */
  function handlePublishVersion(versionId: string) {
    setMessage(null);

    void publishMutation
      .mutateAsync(versionId)
      .then((result) =>
        handleVersionActionResult(
          result,
          "AI Prompt Version을 Publish했습니다.",
        ),
      )
      .catch(handleVersionActionError);
  }

  /**
   * Published Version을 Archive합니다.
   *
   * @param versionId Version ID
   */
  function handleArchiveVersion(versionId: string) {
    setMessage(null);

    void archiveMutation
      .mutateAsync(versionId)
      .then((result) =>
        handleVersionActionResult(
          result,
          "AI Prompt Version을 Archive했습니다.",
        ),
      )
      .catch(handleVersionActionError);
  }

  /**
   * 삭제 가능한 Prompt Version을 삭제합니다.
   *
   * Draft와 Archived Version을 삭제할 수 있습니다.
   *
   * @param versionId Version ID
   */
  function handleDeleteVersion(versionId: string) {
    setMessage(null);

    void deleteMutation
      .mutateAsync({
        familyId: family.id,
        versionId,
      })
      .then((result) =>
        handleVersionActionResult(result, "AI Prompt Version을 삭제했습니다."),
      )
      .catch(handleVersionActionError);
  }

  return (
    <div className="space-y-3">
      <AdminActionMessage message={message} />

      <AdminAiPromptVersionsTable
        familyId={family.id}
        versions={family.versions}
        onPublish={handlePublishVersion}
        onArchive={handleArchiveVersion}
        onDelete={handleDeleteVersion}
      />
    </div>
  );
}
