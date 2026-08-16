"use client";

import { AdminActionMessage } from "../../components/AdminActionMessage";
import { useAdminAiPromptVersionLifecycleActions } from "../hooks/use-admin-ai-prompt-version-lifecycle-actions";
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
  const {
    handleArchiveVersion,
    handleDeleteVersion,
    handlePublishVersion,
    message,
  } = useAdminAiPromptVersionLifecycleActions({
    familyId: family.id,
  });

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
