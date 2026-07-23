"use client";

import { useState } from "react";

import { AdminListToolbar } from "@/features/admin/components/common/AdminListToolbar";
import { AdminPagination } from "@/features/admin/components/common/AdminPagination";
import { AdminPageHeader } from "@/features/admin/components/layout/AdminPageHeader";
import { useAdminListToolbar } from "@/features/admin/hooks/use-admin-list-toolbar";

import {
  COMPONENT_PLAYGROUND_FILTERS,
  type ComponentPlaygroundFilterField,
} from "../constants/filters";
import { COMPONENT_PLAYGROUND_PAGINATION } from "../constants/pagination";
import {
  COMPONENT_PLAYGROUND_SEARCH_FIELDS,
  type ComponentPlaygroundSearchField,
} from "../constants/search";
import { useMockUsers } from "../hooks/queries/use-mock-users";
import { AdminComponentPlaygroundSection } from "./AdminComponentPlaygroundSection";
import { MockUserTable } from "./MockUserTable";

/**
 * 관리자 페이지에서 사용하는 공통 컴포넌트의 표시 상태와
 * 사용자 상호작용을 직접 확인하기 위한 Playground입니다.
 *
 * 공통 컴포넌트가 실제 관리자 목록 화면에서 사용되는 형태를
 * Mock 사용자 데이터를 통해 검증합니다.
 */
export function AdminComponentPlaygroundClient() {
  const [currentPage, setCurrentPage] = useState(1);

  const toolbar = useAdminListToolbar<
    ComponentPlaygroundSearchField,
    ComponentPlaygroundFilterField
  >({
    initialSearchField: "name",
    onApply: () => setCurrentPage(1),
  });

  /**
   * 적용된 검색, 필터, 페이지 조건을 기준으로
   * Server Action을 통해 Mock 사용자 목록을 조회합니다.
   */
  const { data, isPending, isError, isFetching } = useMockUsers({
    page: currentPage,
    pageSize: COMPONENT_PLAYGROUND_PAGINATION.PAGE_SIZE,
    search: toolbar.search,
    filters: toolbar.filters,
  });

  const users = data?.items ?? [];
  const totalCount = data?.pagination.total ?? 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Component Playground"
        description="관리자 페이지에서 사용하는 컴포넌트를 확인합니다."
      />

      <div className="space-y-4">
        <AdminComponentPlaygroundSection
          title="AdminListToolbar / AdminSearch"
          description="검색 필드 Select와 검색어 Input의 상태 변경을 확인합니다."
        >
          <AdminListToolbar
            searchFields={COMPONENT_PLAYGROUND_SEARCH_FIELDS}
            filterDefinitions={COMPONENT_PLAYGROUND_FILTERS}
            toolbar={toolbar}
          />

          <div className="rounded-md bg-muted p-4 text-sm">
            <dl className="grid gap-2 sm:grid-cols-4">
              <div className="flex gap-2">
                <dt className="font-medium">검색 필드:</dt>
                <dd>{toolbar.appliedSearch.field}</dd>
              </div>

              <div className="flex gap-2">
                <dt className="font-medium">검색어:</dt>
                <dd>{toolbar.appliedSearch.query || "-"}</dd>
              </div>

              <div className="flex gap-2">
                <dt className="font-medium">선택 필터:</dt>
                <dd>
                  {toolbar.selectedFilters.length > 0
                    ? toolbar.selectedFilters
                        .map((filter) => filter.label)
                        .join(", ")
                    : "-"}
                </dd>
              </div>

              <div className="flex gap-2">
                <dt className="font-medium">조회 상태:</dt>
                <dd>{isFetching ? "조회 중" : "완료"}</dd>
              </div>
            </dl>
          </div>
        </AdminComponentPlaygroundSection>

        <MockUserTable users={users} isPending={isPending} isError={isError} />

        <AdminComponentPlaygroundSection
          title="AdminPagination"
          description="Mock Server Action 조회 결과를 이용해 페이지 이동과 페이지 그룹 전환 동작을 확인합니다."
        >
          <AdminPagination
            currentPage={currentPage}
            totalCount={totalCount}
            pageSize={COMPONENT_PLAYGROUND_PAGINATION.PAGE_SIZE}
            pageCount={COMPONENT_PLAYGROUND_PAGINATION.PAGE_COUNT}
            onPageChange={setCurrentPage}
          />
        </AdminComponentPlaygroundSection>
      </div>
    </div>
  );
}
