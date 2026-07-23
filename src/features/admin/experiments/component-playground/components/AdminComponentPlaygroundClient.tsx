"use client";

import { useMemo, useState } from "react";

import { AdminFilterAdd } from "@/features/admin/components/common/AdminFilterAdd";
import { AdminFilterBadge } from "@/features/admin/components/common/AdminFilterBadge";
import { AdminFilterEditor } from "@/features/admin/components/common/AdminFilterEditor";
import { AdminListToolbar } from "@/features/admin/components/common/AdminListToolbar";
import { AdminPagination } from "@/features/admin/components/common/AdminPagination";
import { AdminSearch } from "@/features/admin/components/common/AdminSearch";
import { AdminPageHeader } from "@/features/admin/components/layout/AdminPageHeader";
import {
  AdminAppliedFilter,
  AdminFilterDefinition,
} from "@/features/admin/types/filter";
import type { AdminSearchValue } from "@/features/admin/types/search";
import { hasAdminFilterValue } from "@/features/admin/utils/admin-filter";

import {
  COMPONENT_PLAYGROUND_FILTERS,
  ComponentPlaygroundFilterField,
} from "../constants/filters";
import { MOCK_USERS } from "../constants/mock-users";
import { COMPONENT_PLAYGROUND_PAGINATION } from "../constants/pagination";
import {
  COMPONENT_PLAYGROUND_SEARCH_FIELDS,
  type ComponentPlaygroundSearchField,
} from "../constants/search";
import { filterMockUsers } from "../utils/filter-mock-users";
import { AdminComponentPlaygroundSection } from "./AdminComponentPlaygroundSection";

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
};

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

  const [draftFilters, setDraftFilters] = useState<
    Partial<
      Record<
        ComponentPlaygroundFilterField,
        AdminAppliedFilter<ComponentPlaygroundFilterField>
      >
    >
  >({});

  const [appliedFilters, setAppliedFilters] = useState<
    Partial<
      Record<
        ComponentPlaygroundFilterField,
        AdminAppliedFilter<ComponentPlaygroundFilterField>
      >
    >
  >({});

  /**
   * 사용자가 선택한 필터를 Playground의 적용 필터 목록에 추가합니다.
   *
   * 이미 추가된 필터는 AdminFilterAdd에서 제외되므로
   * 이 함수에서는 단순히 새 필터를 배열에 추가합니다.
   *
   * @param filter 사용자가 선택한 필터 정의
   */
  function handleFilterSelect(
    filter: AdminFilterDefinition<ComponentPlaygroundFilterField>,
  ) {
    setSelectedFilters((currentFilters) => [...currentFilters, filter]);
  }

  /**
   * Editor에서 변경된 임시 필터 값을 필드별로 저장합니다.
   *
   * 실제 목록 조회에 사용하는 적용 값은 이후 별도 상태로 분리합니다.
   *
   * @param value 변경된 임시 필터 값
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
   * 지정한 필터를 선택 목록과 임시 값에서 제거합니다.
   *
   * @param field 제거할 필터 필드
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
   * 현재 임시 필터 값을 실제 목록 조회 조건으로 적용합니다.
   *
   * 값이 설정되지 않은 필터는 적용 목록에서 제거하여
   * 빈 필터가 조회 조건에 포함되지 않도록 합니다.
   *
   * @param field 적용할 필터 필드
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
   * 현재 입력된 검색 조건을 사용자 목록에 적용합니다.
   *
   * 검색어의 앞뒤 공백을 제거하고 결과 목록을 첫 페이지부터 표시합니다.
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

  /**
   * 현재 검색 조건과 적용 필터를 모두 반영한 Mock 사용자 목록입니다.
   */
  const filteredUsers = useMemo(
    () =>
      filterMockUsers({
        users: MOCK_USERS,
        search: appliedSearch,
        filters: appliedFilters,
      }),
    [appliedSearch, appliedFilters],
  );

  /**
   * 검색과 필터가 적용된 목록 중 현재 페이지에 표시할 사용자입니다.
   */
  const users = useMemo(() => {
    const startIndex =
      (currentPage - 1) * COMPONENT_PLAYGROUND_PAGINATION.PAGE_SIZE;

    const endIndex = startIndex + COMPONENT_PLAYGROUND_PAGINATION.PAGE_SIZE;

    return filteredUsers.slice(startIndex, endIndex);
  }, [currentPage, filteredUsers]);

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

          {/*
           * AdminSearch가 외부에서 상태를 제어하는 컴포넌트인지
           * Playground에서 직접 확인하기 위한 상태 표시 영역입니다.
           */}
          <div className="rounded-md bg-muted p-4 text-sm">
            <dl className="grid gap-2 sm:grid-cols-3">
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
            </dl>
          </div>
        </AdminComponentPlaygroundSection>

        {/*
         * Mock 사용자 목록은 각 실험 컴포넌트의 동작 결과를
         * 공통으로 확인하기 위한 데이터 표시 영역입니다.
         *
         * 페이지네이션뿐 아니라 이후 검색과 필터 실험에서도
         * 동일한 목록을 사용합니다.
         */}
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">ID</th>

                <th className="px-4 py-3 text-left font-medium">이름</th>

                <th className="px-4 py-3 text-left font-medium">이메일</th>

                <th className="px-4 py-3 text-left font-medium">상태</th>

                <th className="px-4 py-3 text-left font-medium">역할</th>

                <th className="px-4 py-3 text-left font-medium">등급</th>

                <th className="px-4 py-3 text-left font-medium">점수</th>

                <th className="px-4 py-3 text-left font-medium">가입일</th>
              </tr>
            </thead>

            <tbody>
              {users.length > 0 ? (
                users.map((user) => (
                  <tr key={user.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3">{user.id}</td>

                    <td className="px-4 py-3">{user.name}</td>

                    <td className="px-4 py-3">{user.email}</td>

                    <td className="px-4 py-3">
                      {USER_STATUS_LABELS[user.status]}
                    </td>

                    <td className="px-4 py-3">
                      {user.roles
                        .map((role) => USER_ROLE_LABELS[role])
                        .join(", ")}
                    </td>

                    <td className="px-4 py-3">
                      {USER_GRADE_LABELS[user.grade]}
                    </td>

                    <td className="px-4 py-3">{user.score}</td>

                    <td className="px-4 py-3">
                      {user.createdAt.toLocaleDateString("ko-KR")}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    검색 조건과 일치하는 사용자가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <AdminComponentPlaygroundSection
          title="AdminPagination"
          description="Mock 사용자 목록을 이용해 페이지 이동과 페이지 그룹 전환 동작을 확인합니다."
        >
          <AdminPagination
            currentPage={currentPage}
            totalCount={filteredUsers.length}
            pageSize={COMPONENT_PLAYGROUND_PAGINATION.PAGE_SIZE}
            pageCount={COMPONENT_PLAYGROUND_PAGINATION.PAGE_COUNT}
            onPageChange={setCurrentPage}
          />
        </AdminComponentPlaygroundSection>
      </div>
    </div>
  );
}
