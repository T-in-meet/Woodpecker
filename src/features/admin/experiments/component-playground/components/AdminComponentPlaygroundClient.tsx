"use client";

import { useState } from "react";

import { AdminFilterAdd } from "@/features/admin/components/common/AdminFilterAdd";
import { AdminFilterBadge } from "@/features/admin/components/common/AdminFilterBadge";
import { AdminFilterEditor } from "@/features/admin/components/common/AdminFilterEditor";
import { AdminListToolbar } from "@/features/admin/components/common/AdminListToolbar";
import { AdminPagination } from "@/features/admin/components/common/AdminPagination";
import { AdminSearch } from "@/features/admin/components/common/AdminSearch";
import { AdminPageHeader } from "@/features/admin/components/layout/AdminPageHeader";
import type {
  AdminAppliedFilter,
  AdminFilterDefinition,
} from "@/features/admin/types/filter";
import type { AdminSearchValue } from "@/features/admin/types/search";
import { hasAdminFilterValue } from "@/features/admin/utils/admin-filter";

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

const USER_STATUS_LABELS = {
  active: "활성",
  inactive: "비활성",
  suspended: "정지",
} as const;

const USER_ROLE_LABELS = {
  user: "사용자",
  editor: "편집자",
  manager: "매니저",
  admin: "관리자",
} as const;

const USER_GRADE_LABELS = {
  basic: "일반",
  premium: "프리미엄",
  vip: "VIP",
} as const;

type PlaygroundFilters = Partial<
  Record<
    ComponentPlaygroundFilterField,
    AdminAppliedFilter<ComponentPlaygroundFilterField>
  >
>;

/**
 * 관리자 페이지에서 사용하는 공통 컴포넌트의 표시 상태와
 * 사용자 상호작용을 직접 확인하기 위한 Playground입니다.
 *
 * 공통 컴포넌트가 실제 관리자 목록 화면에서 사용되는 형태를
 * Mock 사용자 데이터를 통해 검증합니다.
 */
export function AdminComponentPlaygroundClient() {
  const [currentPage, setCurrentPage] = useState(1);

  const [draftSearch, setDraftSearch] = useState<
    AdminSearchValue<ComponentPlaygroundSearchField>
  >({
    field: "name",
    query: "",
  });

  const [appliedSearch, setAppliedSearch] = useState<
    AdminSearchValue<ComponentPlaygroundSearchField>
  >({
    field: "name",
    query: "",
  });

  const [selectedFilters, setSelectedFilters] = useState<
    AdminFilterDefinition<ComponentPlaygroundFilterField>[]
  >([]);

  const [editingFilterField, setEditingFilterField] =
    useState<ComponentPlaygroundFilterField | null>(null);

  const [draftFilters, setDraftFilters] = useState<PlaygroundFilters>({});

  const [appliedFilters, setAppliedFilters] = useState<PlaygroundFilters>({});

  /**
   * 적용된 검색, 필터, 페이지 조건을 기준으로
   * Server Action을 통해 Mock 사용자 목록을 조회합니다.
   */
  const { data, isPending, isError, isFetching } = useMockUsers({
    page: currentPage,
    pageSize: COMPONENT_PLAYGROUND_PAGINATION.PAGE_SIZE,
    search: appliedSearch,
    filters: appliedFilters,
  });

  const users = data?.items ?? [];
  const totalCount = data?.pagination.total ?? 0;

  /**
   * 사용자가 선택한 필터를 Playground의 필터 목록에 추가합니다.
   *
   * 이미 추가된 필터는 AdminFilterAdd에서 제외되므로
   * 이 함수에서는 새 필터만 배열에 추가합니다.
   */
  function handleFilterSelect(
    filter: AdminFilterDefinition<ComponentPlaygroundFilterField>,
  ) {
    setSelectedFilters((currentFilters) => [...currentFilters, filter]);
  }

  /**
   * Editor에서 변경된 임시 필터 값을 필드별로 저장합니다.
   */
  function handleDraftFilterChange(
    value: AdminAppliedFilter<ComponentPlaygroundFilterField>,
  ) {
    setDraftFilters((currentFilters) => ({
      ...currentFilters,
      [value.field]: value,
    }));
  }

  /**
   * 지정한 필터를 선택 목록, 임시 값, 적용 값에서 제거합니다.
   */
  function handleFilterRemove(field: ComponentPlaygroundFilterField) {
    setSelectedFilters((currentFilters) =>
      currentFilters.filter((filter) => filter.field !== field),
    );

    setDraftFilters((currentFilters) => {
      const nextFilters = { ...currentFilters };

      delete nextFilters[field];

      return nextFilters;
    });

    setAppliedFilters((currentFilters) => {
      const nextFilters = { ...currentFilters };

      delete nextFilters[field];

      return nextFilters;
    });

    setCurrentPage(1);
  }

  /**
   * 현재 임시 필터 값을 실제 조회 조건으로 적용합니다.
   *
   * 적용 필터 상태가 변경되면 useMockUsers의 queryKey가 변경되어
   * Server Action이 새로운 조건으로 다시 실행됩니다.
   */
  function handleFilterApply(field: ComponentPlaygroundFilterField) {
    const draftFilter = draftFilters[field];

    setAppliedFilters((currentFilters) => {
      const nextFilters = {
        ...currentFilters,
      };

      if (!draftFilter || !hasAdminFilterValue(draftFilter)) {
        delete nextFilters[field];

        return nextFilters;
      }

      nextFilters[field] = draftFilter;

      return nextFilters;
    });

    setCurrentPage(1);
  }

  /**
   * 현재 입력된 검색 조건을 실제 조회 조건으로 적용합니다.
   *
   * 적용 검색 상태가 변경되면 useMockUsers의 queryKey가 변경되어
   * Server Action이 새로운 조건으로 다시 실행됩니다.
   */
  function handleSearchApply() {
    const normalizedSearch = {
      ...draftSearch,
      query: draftSearch.query.trim(),
    };

    setDraftSearch(normalizedSearch);
    setAppliedSearch(normalizedSearch);
    setCurrentPage(1);
  }

  const appliedFilterFields = selectedFilters.map((filter) => filter.field);

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
            search={
              <AdminSearch
                fields={COMPONENT_PLAYGROUND_SEARCH_FIELDS}
                value={draftSearch}
                onChange={setDraftSearch}
                onSearch={handleSearchApply}
              />
            }
            filters={
              <>
                {selectedFilters.map((filter) => {
                  const draftFilter = draftFilters[filter.field];
                  const appliedFilter = appliedFilters[filter.field];

                  const isActive = appliedFilter
                    ? hasAdminFilterValue(appliedFilter)
                    : false;

                  return (
                    <AdminFilterEditor
                      key={filter.field}
                      filter={filter}
                      value={draftFilter ?? null}
                      open={editingFilterField === filter.field}
                      onOpenChange={(open) => {
                        setEditingFilterField(open ? filter.field : null);
                      }}
                      onChange={handleDraftFilterChange}
                      onApply={() => handleFilterApply(filter.field)}
                      onRemove={() => handleFilterRemove(filter.field)}
                      trigger={
                        <AdminFilterBadge
                          label={filter.label}
                          isActive={isActive}
                          onRemove={() => handleFilterRemove(filter.field)}
                        />
                      }
                    />
                  );
                })}

                <AdminFilterAdd
                  filters={COMPONENT_PLAYGROUND_FILTERS}
                  appliedFields={appliedFilterFields}
                  onSelect={handleFilterSelect}
                />
              </>
            }
          />

          <div className="rounded-md bg-muted p-4 text-sm">
            <dl className="grid gap-2 sm:grid-cols-4">
              <div className="flex gap-2">
                <dt className="font-medium">검색 필드:</dt>

                <dd>{appliedSearch.field}</dd>
              </div>

              <div className="flex gap-2">
                <dt className="font-medium">검색어:</dt>

                <dd>{appliedSearch.query || "-"}</dd>
              </div>

              <div className="flex gap-2">
                <dt className="font-medium">선택 필터:</dt>

                <dd>
                  {selectedFilters.length > 0
                    ? selectedFilters.map((filter) => filter.label).join(", ")
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
