import Link from "next/link";

import { getAdminAiPromptVersionRoute } from "@/lib/constants/routes";

import type { AdminAiPromptVersionRow } from "../../types";
import { AdminAiPromptVersionActions } from "./AdminAiPromptVersionActions";
import { AdminAiPromptVersionStatus } from "./AdminAiPromptVersionStatus";

type AdminAiPromptVersionsTableProps = {
  /** Prompt Family ID */
  familyId: string;

  /** Prompt Version 목록 */
  versions: AdminAiPromptVersionRow[];

  /** Draft Version Publish 이벤트 */
  onPublish: (versionId: string) => void;

  /** Published Version Archive 이벤트 */
  onArchive: (versionId: string) => void;

  /** 삭제 가능한 Version 삭제 이벤트 */
  onDelete: (versionId: string) => void;
};

/**
 * Prompt Family에 속한 Version 목록과 lifecycle 작업을 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @returns Prompt Version 관리 테이블
 */
export function AdminAiPromptVersionsTable({
  familyId,
  versions,
  onPublish,
  onArchive,
  onDelete,
}: AdminAiPromptVersionsTableProps) {
  const latestVersion = versions[0] ?? null;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold">Versions</h2>

        {latestVersion ? (
          <p className="text-sm text-muted-foreground">
            최신 v{latestVersion.versionNumber} 기준으로 새 Draft를 만들 수
            있습니다.
          </p>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-260 text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Version</th>
                <th className="px-4 py-3 text-left font-medium">이름</th>
                <th className="px-4 py-3 text-left font-medium">상태</th>
                <th className="px-4 py-3 text-left font-medium">요약</th>
                <th className="px-4 py-3 text-left font-medium">작업</th>
              </tr>
            </thead>

            <tbody>
              {versions.map((version) => (
                <tr key={version.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={getAdminAiPromptVersionRoute(familyId, version.id)}
                      className="font-mono text-xs underline-offset-4 hover:underline"
                    >
                      v{version.versionNumber}
                    </Link>
                  </td>

                  <td className="px-4 py-3 align-top">
                    <Link
                      href={getAdminAiPromptVersionRoute(familyId, version.id)}
                      className="font-mono text-xs underline-offset-4 hover:underline"
                    >
                      {version.displayName}
                    </Link>
                  </td>

                  <td className="px-4 py-3 align-top">
                    <AdminAiPromptVersionStatus version={version} />
                  </td>

                  <td className="max-w-96 px-4 py-3 align-top">
                    <span
                      className="line-clamp-2"
                      title={version.changeSummary ?? undefined}
                    >
                      {version.changeSummary ?? "-"}
                    </span>
                  </td>

                  <td className="px-4 py-3 align-top">
                    <AdminAiPromptVersionActions
                      version={version}
                      onPublish={onPublish}
                      onArchive={onArchive}
                      onDelete={onDelete}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
