"use client";

import { useState } from "react";

import { AdminListToolbar } from "@/features/admin/components/common/AdminListToolbar";
import { AdminPagination } from "@/features/admin/components/common/AdminPagination";
import { useAdminListToolbar } from "@/features/admin/hooks/use-admin-list-toolbar";
import { ROUTES } from "@/lib/constants/routes";

import { AdminPageHeader } from "../../components/layout/AdminPageHeader";
import { ADMIN_OPERATIONAL_ERROR_LIST_CONFIG } from "../constants/operational-error-list";
import { useOperationalErrors } from "../hooks/use-operational-errors";
import { AdminOperationalErrorsTable } from "./AdminOperationalErrorsTable";

export function AdminOperationalErrorsClient() {
  const [currentPage, setCurrentPage] = useState(1);
  const toolbar = useAdminListToolbar({
    config: ADMIN_OPERATIONAL_ERROR_LIST_CONFIG,
    onApply: () => setCurrentPage(1),
  });
  const { data, isError, isPending } = useOperationalErrors({
    filters: toolbar.filters,
    page: currentPage,
    pageSize: ADMIN_OPERATIONAL_ERROR_LIST_CONFIG.pagination.pageSize,
    search: toolbar.search,
    sort: toolbar.sort,
  });
  const operationalErrors = data?.items ?? [];
  const totalCount = data?.pagination.total ?? 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="운영 오류"
        description="주요 기능에서 명시적으로 기록한 운영 오류를 조회하고 해결 상태를 관리합니다."
        backLabel="대시보드"
        backHref={ROUTES.ADMIN.DASHBOARD}
      />

      <div className="space-y-4">
        <AdminListToolbar
          config={ADMIN_OPERATIONAL_ERROR_LIST_CONFIG}
          toolbar={toolbar}
        />

        <AdminOperationalErrorsTable
          isError={isError}
          isPending={isPending}
          operationalErrors={operationalErrors}
          sort={toolbar.sort}
          onSortChange={toolbar.handleSortChange}
        />

        <AdminPagination
          config={ADMIN_OPERATIONAL_ERROR_LIST_CONFIG.pagination}
          currentPage={currentPage}
          totalCount={totalCount}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
