import Link from "next/link";

import {
  AdminListEmpty,
  AdminListError,
} from "@/features/admin/components/common/AdminListState";
import { getAdminOperationalErrorDetailRoute } from "@/lib/constants/routes";

import { AdminBadge } from "../../components/common/AdminBadge";
import { AdminSortableTableHead } from "../../components/common/AdminSortableTableHead";
import type { AdminSort } from "../../types/sort";
import {
  OPERATIONAL_ERROR_SEVERITY_BADGE_CONFIG,
  OPERATIONAL_ERROR_STATUS_BADGE_CONFIG,
} from "../constants/operational-error-list";
import type {
  OperationalErrorListItem,
  OperationalErrorSortField,
} from "../types/operational-error-list";

type AdminOperationalErrorsTableProps = {
  isError: boolean;
  isPending: boolean;
  onSortChange: (sort: AdminSort<OperationalErrorSortField>) => void;
  operationalErrors: OperationalErrorListItem[];
  sort: AdminSort<OperationalErrorSortField>;
};

export function AdminOperationalErrorsTable({
  isError,
  isPending,
  onSortChange,
  operationalErrors,
  sort,
}: AdminOperationalErrorsTableProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-300 text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <AdminSortableTableHead
                field="status"
                sort={sort}
                onSortChange={onSortChange}
              >
                상태
              </AdminSortableTableHead>
              <AdminSortableTableHead
                field="errorCode"
                sort={sort}
                onSortChange={onSortChange}
              >
                오류 코드
              </AdminSortableTableHead>
              <AdminSortableTableHead
                field="severity"
                sort={sort}
                onSortChange={onSortChange}
              >
                심각도
              </AdminSortableTableHead>
              <AdminSortableTableHead
                field="feature"
                sort={sort}
                onSortChange={onSortChange}
              >
                기능
              </AdminSortableTableHead>
              <AdminSortableTableHead
                field="operation"
                sort={sort}
                onSortChange={onSortChange}
              >
                작업
              </AdminSortableTableHead>
              <AdminSortableTableHead
                field="stage"
                sort={sort}
                onSortChange={onSortChange}
              >
                단계
              </AdminSortableTableHead>

              <AdminSortableTableHead
                field="occurrenceCount"
                sort={sort}
                onSortChange={onSortChange}
              >
                발생
              </AdminSortableTableHead>
              <AdminSortableTableHead
                field="lastSeenAt"
                sort={sort}
                onSortChange={onSortChange}
              >
                최근 발생
              </AdminSortableTableHead>
            </tr>
          </thead>

          <tbody>
            {isPending ? (
              <OperationalErrorsTableSkeleton />
            ) : isError ? (
              <tr>
                <td colSpan={8}>
                  <AdminListError description="운영 오류 목록을 불러오지 못했습니다." />
                </td>
              </tr>
            ) : operationalErrors.length > 0 ? (
              operationalErrors.map((error) => (
                <tr key={error.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 align-top">
                    <OperationalErrorStatusBadge status={error.status} />
                  </td>
                  <td className="max-w-lg px-4 py-3 align-top">
                    <Link
                      href={getAdminOperationalErrorDetailRoute(error.id)}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {error.errorCode}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-muted-foreground">
                      {error.message}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <OperationalErrorSeverityBadge severity={error.severity} />
                  </td>
                  <td className="px-4 py-3 align-top">{error.feature}</td>
                  <td className="px-4 py-3 align-top">{error.operation}</td>
                  <td className="px-4 py-3 align-top">{error.stage}</td>

                  <td className="px-4 py-3 align-top">
                    {error.occurrenceCount.toLocaleString("ko-KR")}회
                  </td>
                  <td className="px-4 py-3 align-top">
                    {formatDateTime(error.lastSeenAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8}>
                  <AdminListEmpty description="검색 조건과 일치하는 운영 오류가 없습니다." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OperationalErrorsTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }, (_, index) => (
        <tr key={index} className="border-b last:border-b-0">
          {Array.from({ length: 8 }, (_, cellIndex) => (
            <td key={cellIndex} className="px-4 py-3">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function OperationalErrorStatusBadge({
  status,
}: {
  status: OperationalErrorListItem["status"];
}) {
  const badge = OPERATIONAL_ERROR_STATUS_BADGE_CONFIG[status];

  return <AdminBadge color={badge.color}>{badge.label}</AdminBadge>;
}

function OperationalErrorSeverityBadge({
  severity,
}: {
  severity: OperationalErrorListItem["severity"];
}) {
  const badge = OPERATIONAL_ERROR_SEVERITY_BADGE_CONFIG[severity];

  return <AdminBadge color={badge.color}>{badge.label}</AdminBadge>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
