import Link from "next/link";

import { TableHead } from "@/components/ui/table";
import {
  AdminListEmpty,
  AdminListError,
} from "@/features/admin/components/common/AdminListState";
import { AdminSortableTableHead } from "@/features/admin/components/common/AdminSortableTableHead";
import type { AdminSort } from "@/features/admin/types/sort";
import { getAdminAiAgentRoute } from "@/lib/constants/routes";
import { formatDateTime } from "@/lib/utils/formatDate";

import type { AdminAiAgentListRow, AdminAiAgentSortField } from "../types";
import { AdminAiAgentsTableSkeleton } from "./AdminAiAgentsTableSkeleton";

type AdminAiAgentsTableProps = {
  /** 현재 페이지에 표시할 Agent 목록 */
  agents: AdminAiAgentListRow[];

  /** 최초 목록 조회 진행 여부 */
  isPending: boolean;

  /** 목록 조회 실패 여부 */
  isError: boolean;

  /** 현재 적용된 정렬 조건 */
  sort: AdminSort<AdminAiAgentSortField>;

  /** 정렬 조건 변경 이벤트 */
  onSortChange: (sort: AdminSort<AdminAiAgentSortField>) => void;
};

/**
 * 관리자 AI Agent 목록을 테이블 형태로 표시합니다.
 *
 * 각 행의 이름은 상세 페이지 진입점이며, 로딩/오류/빈 결과 상태를
 * 테이블 영역 안에서 동일한 구조로 처리합니다.
 */
export function AdminAiAgentsTable({
  agents,
  isPending,
  isError,
  sort,
  onSortChange,
}: AdminAiAgentsTableProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-220 text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <AdminSortableTableHead
                field="displayName"
                sort={sort}
                onSortChange={onSortChange}
              >
                이름
              </AdminSortableTableHead>

              <TableHead>목적</TableHead>

              <AdminSortableTableHead
                field="familyCount"
                sort={sort}
                onSortChange={onSortChange}
              >
                Family 수
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
              <AdminAiAgentsTableSkeleton />
            ) : isError ? (
              <tr>
                <td colSpan={5}>
                  <AdminListError description="Agent 목록을 불러오지 못했습니다." />
                </td>
              </tr>
            ) : agents.length > 0 ? (
              agents.map((agent) => (
                <tr key={agent.id} className="border-b last:border-b-0">
                  <td className="max-w-72 px-4 py-3 align-top">
                    <Link
                      href={getAdminAiAgentRoute(agent.id)}
                      className="block truncate font-medium underline-offset-4 hover:underline"
                      title={agent.displayName}
                    >
                      {agent.displayName}
                    </Link>
                  </td>

                  <td className="max-w-80 px-4 py-3 align-top">
                    <span className="line-clamp-2">{agent.purpose ?? "-"}</span>
                  </td>

                  <td className="px-4 py-3 align-top">{agent.familyCount}</td>

                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    {formatDateTime(agent.createdAt)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    {formatDateTime(agent.updatedAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  <AdminListEmpty description="조건과 일치하는 Agent가 없습니다." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
