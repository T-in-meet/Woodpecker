"use client";

import { useState } from "react";

import { AdminListToolbar } from "@/features/admin/components/common/AdminListToolbar";
import { AdminPagination } from "@/features/admin/components/common/AdminPagination";
import { useAdminListToolbar } from "@/features/admin/hooks/use-admin-list-toolbar";

import { AdminPageHeader } from "../../components/layout/AdminPageHeader";
import { ADMIN_FEEDBACK_LIST_CONFIG } from "../constants/feedback-list";
import { useFeedbacks } from "../hooks/use-feedbacks";
import { AdminFeedbackTable } from "./AdminFeedbackTable";

/**
 * 관리자 피드백 목록 페이지의 클라이언트 컨테이너입니다.
 *
 * 공통 관리자 toolbar 상태를 TanStack Query의 목록 조회 조건으로 연결하고,
 * 검색/필터 적용 시 현재 페이지를 첫 페이지로 되돌립니다.
 */
export function AdminFeedbackClient() {
  const [currentPage, setCurrentPage] = useState(1);

  const toolbar = useAdminListToolbar({
    config: ADMIN_FEEDBACK_LIST_CONFIG,
    onApply: () => setCurrentPage(1),
  });

  const { data, isPending, isError } = useFeedbacks({
    page: currentPage,
    pageSize: ADMIN_FEEDBACK_LIST_CONFIG.pagination.pageSize,
    search: toolbar.search,
    filters: toolbar.filters,
    sort: toolbar.sort,
  });

  const feedbacks = data?.items ?? [];
  const totalCount = data?.pagination.total ?? 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="사용자 피드백"
        description="사용자가 전달한 피드백을 조회하고 관리합니다."
      />

      <div className="space-y-4">
        <AdminListToolbar
          config={ADMIN_FEEDBACK_LIST_CONFIG}
          toolbar={toolbar}
        />

        <AdminFeedbackTable
          feedbacks={feedbacks}
          isPending={isPending}
          isError={isError}
          sort={toolbar.sort}
          onSortChange={toolbar.handleSortChange}
        />

        <AdminPagination
          currentPage={currentPage}
          totalCount={totalCount}
          config={ADMIN_FEEDBACK_LIST_CONFIG.pagination}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
