import Link from "next/link";

import { TableHead } from "@/components/ui/table";
import { AdminBadge } from "@/features/admin/components/common/AdminBadge";
import {
  AdminListEmpty,
  AdminListError,
} from "@/features/admin/components/common/AdminListState";
import { AdminSortableTableHead } from "@/features/admin/components/common/AdminSortableTableHead";
import type { AdminSort } from "@/features/admin/types/sort";
import { getAdminAiModelRoute } from "@/lib/constants/routes";
import { formatDateTime } from "@/lib/utils/formatDate";

import type { AdminAiModelListRow, AdminAiModelSortField } from "../types";
import { AdminAiModelsTableSkeleton } from "./AdminAiModelsTableSkeleton";

type AdminAiModelsTableProps = {
  /** 현재 페이지에 표시할 모델 목록 */
  models: AdminAiModelListRow[];

  /** 최초 목록 조회 진행 여부 */
  isPending: boolean;

  /** 목록 조회 실패 여부 */
  isError: boolean;

  /** 현재 적용된 정렬 조건 */
  sort: AdminSort<AdminAiModelSortField>;

  /** 정렬 조건 변경 이벤트 */
  onSortChange: (sort: AdminSort<AdminAiModelSortField>) => void;
};

/**
 * 관리자 AI 모델 목록을 테이블 형태로 표시합니다.
 *
 * 각 행의 이름은 상세 페이지 진입점이며, 로딩/오류/빈 결과 상태를
 * 테이블 영역 안에서 동일한 구조로 처리합니다.
 *
 * @param props 컴포넌트 속성
 * @returns 관리자 AI 모델 목록 테이블
 */
export function AdminAiModelsTable({
  models,
  isPending,
  isError,
  sort,
  onSortChange,
}: AdminAiModelsTableProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-240 text-sm">
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
                field="provider"
                sort={sort}
                onSortChange={onSortChange}
              >
                Provider
              </AdminSortableTableHead>

              <AdminSortableTableHead
                field="model"
                sort={sort}
                onSortChange={onSortChange}
              >
                모델
              </AdminSortableTableHead>

              <AdminSortableTableHead
                field="capability"
                sort={sort}
                onSortChange={onSortChange}
              >
                용도
              </AdminSortableTableHead>

              <TableHead>상태</TableHead>

              <AdminSortableTableHead
                field="embeddingReferenceCount"
                sort={sort}
                onSortChange={onSortChange}
              >
                참조 수
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
              <AdminAiModelsTableSkeleton />
            ) : isError ? (
              <tr>
                <td colSpan={8}>
                  <AdminListError description="모델 목록을 불러오지 못했습니다." />
                </td>
              </tr>
            ) : models.length > 0 ? (
              models.map((model) => (
                <tr key={model.id} className="border-b last:border-b-0">
                  <td className="max-w-72 px-4 py-3 align-top">
                    <Link
                      href={getAdminAiModelRoute(model.id)}
                      className="block truncate font-medium underline-offset-4 hover:underline"
                      title={model.displayName}
                    >
                      {model.displayName}
                    </Link>
                  </td>

                  <td className="px-4 py-3 align-top">{model.provider}</td>

                  <td className="px-4 py-3 align-top font-mono text-xs">
                    {model.model}
                  </td>

                  <td className="px-4 py-3 align-top">{model.capability}</td>

                  <td className="px-4 py-3 align-top">
                    <ModelStatusBadge isActive={model.isActive} />
                  </td>

                  <td className="px-4 py-3 align-top">
                    {model.embeddingReferenceCount}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    {formatDateTime(model.createdAt)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 align-top">
                    {formatDateTime(model.updatedAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>
                  <AdminListEmpty description="검색 조건과 일치하는 모델이 없습니다." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * 모델 활성 상태를 목록에서 확인할 수 있는 배지로 표시합니다.
 *
 * @param props 모델 활성 상태
 * @returns 모델 활성 상태 배지
 */
function ModelStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <AdminBadge color={isActive ? "green" : "gray"}>
      {isActive ? "active" : "inactive"}
    </AdminBadge>
  );
}
