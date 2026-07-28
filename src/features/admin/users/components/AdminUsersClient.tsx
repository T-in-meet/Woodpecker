"use client";

import { useState } from "react";

import { AdminListToolbar } from "@/features/admin/components/common/AdminListToolbar";
import { AdminPagination } from "@/features/admin/components/common/AdminPagination";
import { useAdminListToolbar } from "@/features/admin/hooks/use-admin-list-toolbar";

import { AdminPageHeader } from "../../components/layout/AdminPageHeader";
import { ADMIN_USER_LIST_CONFIG } from "../constants/user-list";
import { useUsers } from "../hooks/use-users";
import { AdminUserTable } from "./AdminUserTable";

interface AdminUserClientProps {
  /** 현재 로그인한 관리자 ID */
  currentAdminId: string;
}

/**
 * 관리자 사용자 목록 페이지의 클라이언트 컨테이너입니다.
 *
 * 공통 관리자 toolbar 상태를 TanStack Query의 사용자 목록 조회 조건으로 연결하고,
 * 검색/필터 적용 시 현재 페이지를 첫 페이지로 되돌립니다.
 */
export function AdminUsersClient({ currentAdminId }: AdminUserClientProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const toolbar = useAdminListToolbar({
    config: ADMIN_USER_LIST_CONFIG,
    onApply: () => setCurrentPage(1),
  });

  const { data, isPending, isError } = useUsers({
    page: currentPage,
    pageSize: ADMIN_USER_LIST_CONFIG.pagination.pageSize,
    search: toolbar.search,
    filters: toolbar.filters,
    sort: toolbar.sort,
  });

  const users = data?.items ?? [];
  const totalCount = data?.pagination.total ?? 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="사용자 관리"
        description="가입한 사용자를 조회하고 역할을 관리합니다."
      />

      <div className="space-y-4">
        <AdminListToolbar config={ADMIN_USER_LIST_CONFIG} toolbar={toolbar} />

        <AdminUserTable
          users={users}
          currentAdminId={currentAdminId}
          isPending={isPending}
          isError={isError}
          sort={toolbar.sort}
          onSortChange={toolbar.handleSortChange}
        />

        <AdminPagination
          currentPage={currentPage}
          totalCount={totalCount}
          config={ADMIN_USER_LIST_CONFIG.pagination}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
