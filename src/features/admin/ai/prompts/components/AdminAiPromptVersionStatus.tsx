import { AdminBadge } from "@/features/admin/components/common/AdminBadge";

import { AdminAiPromptVersionRow } from "../../types";

type AdminAiPromptVersionStatusProps = {
  /** 표시할 Prompt Version */
  version: AdminAiPromptVersionRow;

  /** Version 번호 배지 표시 여부 */
  showVersionNumber?: boolean;
};

/**
 * Prompt Version의 lifecycle 상태를 배지로 표시합니다.
 *
 * @param props 컴포넌트 속성
 * @returns Prompt Version 상태 배지
 */
export function AdminAiPromptVersionStatus({
  version,
  showVersionNumber = false,
}: AdminAiPromptVersionStatusProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {showVersionNumber ? (
        <AdminBadge color="gray">v{version.versionNumber}</AdminBadge>
      ) : null}

      <AdminBadge
        color={version.lifecycleStatus === "published" ? "green" : "gray"}
      >
        {version.lifecycleStatus}
      </AdminBadge>
    </div>
  );
}
