"use client";

import { useMemo } from "react";

import { AdminSelectField } from "@/features/admin/components/common/AdminSelectField";

import type { AdminAiPromptVersionRow } from "../../types";

type AdminAiPromptVersionLifecycleSelectProps = {
  /** 상태를 변경할 Prompt Version입니다. */
  version: AdminAiPromptVersionRow;

  /** Draft 또는 Archived Version을 Publish합니다. */
  onPublish: (versionId: string) => void;

  /** Published Version을 Archive합니다. */
  onArchive: (versionId: string) => void;

  /** lifecycle 변경 요청 진행 여부입니다. */
  pending?: boolean;
};

/**
 * Prompt Version의 lifecycle 상태를 표시하고 변경합니다.
 *
 * 허용하는 lifecycle 전이는 다음과 같습니다.
 * - draft -> published
 * - published -> archived
 * - archived -> published
 *
 * 현재 상태를 다시 선택한 경우에는 아무 작업도 수행하지 않습니다.
 *
 * @param props 컴포넌트 속성
 * @returns Prompt Version lifecycle 선택 필드
 */
export function AdminAiPromptVersionLifecycleSelect({
  version,
  onPublish,
  onArchive,
  pending = false,
}: AdminAiPromptVersionLifecycleSelectProps) {
  const options = useMemo(() => {
    switch (version.lifecycleStatus) {
      case "draft":
        return [
          { label: "Draft", value: "draft" },
          { label: "Published", value: "published" },
        ];

      case "published":
        return [
          { label: "Published", value: "published" },
          { label: "Archived", value: "archived" },
        ];

      case "archived":
        return [
          { label: "Archived", value: "archived" },
          { label: "Published", value: "published" },
        ];
    }
  }, [version.lifecycleStatus]);

  function handleValueChange(nextStatus: string) {
    if (nextStatus === version.lifecycleStatus) {
      return;
    }

    if (
      (version.lifecycleStatus === "draft" ||
        version.lifecycleStatus === "archived") &&
      nextStatus === "published"
    ) {
      onPublish(version.id);
      return;
    }

    if (version.lifecycleStatus === "published" && nextStatus === "archived") {
      onArchive(version.id);
    }
  }

  return (
    <AdminSelectField
      label="Lifecycle"
      name="lifecycleStatus"
      options={options}
      value={version.lifecycleStatus}
      disabled={pending}
      onValueChange={handleValueChange}
    />
  );
}
