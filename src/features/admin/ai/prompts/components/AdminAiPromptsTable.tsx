import Link from "next/link";

import {
  AdminListEmpty,
  AdminListError,
} from "@/features/admin/components/common/AdminListState";
import { AdminSortableTableHead } from "@/features/admin/components/common/AdminSortableTableHead";
import type { AdminSort } from "@/features/admin/types/sort";
import {
  getAdminAiAgentRoute,
  getAdminAiPromptFamilyRoute,
} from "@/lib/constants/routes";
import { formatDateTime } from "@/lib/utils/formatDate";

import type {
  AdminAiPromptFamilyListRow,
  AdminAiPromptSortField,
} from "../types";
import { AdminAiPromptsTableSkeleton } from "./AdminAiPromptsTableSkeleton";

type AdminAiPromptsTableProps = {
  /** 현재 페이지에 표시할 Prompt Family 목록 */
  families: AdminAiPromptFamilyListRow[];

  /** 최초 목록 조회 진행 여부 */
  isPending: boolean;

  /** 목록 조회 실패 여부 */
  isError: boolean;

  /** 현재 적용된 정렬 조건 */
  sort: AdminSort<AdminAiPromptSortField>;

  /** 정렬 조건 변경 이벤트 */
  onSortChange: (sort: AdminSort<AdminAiPromptSortField>) => void;
};

/**
 * 관리자 AI Prompt Family 목록을 테이블 형태로 표시합니다.
 *
 * 각 행의 Family 이름은 상세 페이지 진입점이며, 로딩/오류/빈 결과 상태를
 * 테이블 영역 안에서 동일한 구조로 처리합니다.
 */
export function AdminAiPromptsTable({
  families,
  isPending,
  isError,
  sort,
  onSortChange,
}: AdminAiPromptsTableProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-260 text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <AdminSortableTableHead
                field="displayName"
                sort={sort}
                onSortChange={onSortChange}
              >
                이름
              </AdminSortableTableHead>

              <AdminSortableTableHead
                field="agentDisplayName"
                sort={sort}
                onSortChange={onSortChange}
              >
                Agent
              </AdminSortableTableHead>

              <AdminSortableTableHead
                field="draftVersionCount"
                sort={sort}
                onSortChange={onSortChange}
              >
                Draft 수
              </AdminSortableTableHead>

              <AdminSortableTableHead
                field="publishedVersionCount"
                sort={sort}
                onSortChange={onSortChange}
              >
                Published 수
              </AdminSortableTableHead>

              <AdminSortableTableHead
                field="archivedVersionCount"
                sort={sort}
                onSortChange={onSortChange}
              >
                Archived 수
              </AdminSortableTableHead>

              <AdminSortableTableHead
                field="createdAt"
                sort={sort}
                onSortChange={onSortChange}
              >
                생성일
              </AdminSortableTableHead>

              <AdminSortableTableHead
                field="updatedAt"
                sort={sort}
                onSortChange={onSortChange}
              >
                수정일
              </AdminSortableTableHead>
            </tr>
          </thead>

          <tbody>
            {isPending ? (
              <AdminAiPromptsTableSkeleton />
            ) : isError ? (
              <tr>
                <td colSpan={7}>
                  <AdminListError description="Prompt 목록을 불러오지 못했습니다." />
                </td>
              </tr>
            ) : families.length > 0 ? (
              families.map((family) => (
                <tr key={family.id} className="border-b last:border-b-0">
                  <td className="max-w-64 px-4 py-3 align-top">
                    <Link
                      href={getAdminAiPromptFamilyRoute(family.id)}
                      className="block truncate font-medium underline-offset-4 hover:underline"
                      title={family.displayName}
                    >
                      {family.displayName}
                    </Link>
                  </td>

                  <td className="px-4 py-3 align-top">
                    <Link href={getAdminAiAgentRoute(family.agentId)}>
                      {family.agentDisplayName}
                    </Link>
                  </td>

                  <td className="px-4 py-3 align-top">
                    {family.draftVersionCount}
                  </td>

                  <td className="px-4 py-3 align-top">
                    {family.publishedVersionCount}
                  </td>

                  <td className="px-4 py-3 align-top">
                    {family.archivedVersionCount}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    {formatDateTime(family.createdAt)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    {formatDateTime(family.updatedAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <AdminListEmpty description="조건과 일치하는 Prompt가 없습니다." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
