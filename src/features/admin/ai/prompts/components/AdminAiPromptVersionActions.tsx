import { Button } from "@/components/ui/button";
import { AdminAlertDialog } from "@/features/admin/components/common/AdminAlertDialog";

import type { AdminAiPromptVersionRow } from "../../types";
import { getAdminAiPromptVersionActions } from "../utils/version-actions";

type AdminAiPromptVersionActionsProps = {
  /** 작업 대상 Prompt Version */
  version: AdminAiPromptVersionRow;

  /** Publish 이벤트 */
  onPublish: (versionId: string) => void;

  /** Archive 이벤트 */
  onArchive: (versionId: string) => void;

  /** 삭제 이벤트 */
  onDelete: (versionId: string) => void;
};

/**
 * Prompt Version에 허용된 lifecycle 작업 버튼을 표시합니다.
 *
 * @param props 컴포넌트 속성
 * @returns Prompt Version 작업 버튼
 */
export function AdminAiPromptVersionActions({
  version,
  onPublish,
  onArchive,
  onDelete,
}: AdminAiPromptVersionActionsProps) {
  const actions = getAdminAiPromptVersionActions(version.lifecycleStatus);

  return (
    <div className="flex flex-wrap gap-2">
      {actions.includes("publish") ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPublish(version.id)}
        >
          Publish
        </Button>
      ) : null}

      {actions.includes("delete") ? (
        <AdminAlertDialog
          trigger={
            <Button type="button" size="sm" variant="destructive">
              삭제
            </Button>
          }
          title="Prompt Version을 삭제할까요?"
          description="삭제한 Prompt Version은 복구할 수 없습니다."
          confirmLabel="삭제"
          confirmVariant="destructive"
          onConfirm={() => onDelete(version.id)}
        />
      ) : null}

      {actions.includes("archive") ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onArchive(version.id)}
        >
          Archive
        </Button>
      ) : null}

      {actions.includes("republish") ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onPublish(version.id)}
        >
          Republish
        </Button>
      ) : null}
    </div>
  );
}
