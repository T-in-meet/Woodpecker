"use client";

import { AdminFilterAdd } from "@/features/admin/components/common/AdminFilterAdd";
import { AdminFilterBadge } from "@/features/admin/components/common/AdminFilterBadge";
import { AdminFilterEditor } from "@/features/admin/components/common/AdminFilterEditor";
import { AdminSearch } from "@/features/admin/components/common/AdminSearch";
import type { UseAdminListToolbarResult } from "@/features/admin/hooks/use-admin-list-toolbar";
import type { AdminFilterDefinition } from "@/features/admin/types/filter";
import type { AdminSearchField } from "@/features/admin/types/search";
import { hasAdminFilterValue } from "@/features/admin/utils/admin-filter";

interface AdminListToolbarProps<
  TSearchField extends string,
  TFilterField extends string,
> {
  /** 관리자 목록에서 선택할 수 있는 검색 필드 목록 */
  searchFields: readonly AdminSearchField<TSearchField>[];

  /** 관리자 목록에서 추가할 수 있는 필터 정의 목록 */
  filterDefinitions: readonly AdminFilterDefinition<TFilterField>[];

  /** 검색과 필터 상태 및 처리 함수 */
  toolbar: UseAdminListToolbarResult<TSearchField, TFilterField>;
}

/**
 * 관리자 목록에서 사용하는 공통 검색 및 필터 Toolbar입니다.
 *
 * 검색 입력, 필터 추가, 필터 Editor 렌더링을 내부에서 조합하여
 * 각 목록 페이지에서 반복되는 상태 연결 코드를 줄입니다.
 */
export function AdminListToolbar<
  TSearchField extends string,
  TFilterField extends string,
>({
  searchFields,
  filterDefinitions,
  toolbar,
}: AdminListToolbarProps<TSearchField, TFilterField>) {
  return (
    <div className="flex flex-col gap-3">
      <AdminSearch
        fields={searchFields}
        value={toolbar.draftSearch}
        onChange={toolbar.setDraftSearch}
        onSearch={toolbar.handleSearchApply}
      />

      <div className="flex flex-wrap items-center gap-2">
        {toolbar.selectedFilters.map((filter) => {
          const draftFilter = toolbar.draftFilters[filter.field];
          const appliedFilter = toolbar.appliedFilters[filter.field];

          const isActive = appliedFilter
            ? hasAdminFilterValue(appliedFilter)
            : false;

          return (
            <AdminFilterEditor
              key={filter.field}
              filter={filter}
              value={draftFilter ?? null}
              open={toolbar.editingFilterField === filter.field}
              onOpenChange={(open) => {
                toolbar.setEditingFilterField(open ? filter.field : null);
              }}
              onChange={toolbar.handleDraftFilterChange}
              onApply={() => toolbar.handleFilterApply(filter.field)}
              onRemove={() => toolbar.handleFilterRemove(filter.field)}
              trigger={
                <AdminFilterBadge
                  label={filter.label}
                  isActive={isActive}
                  onRemove={() => toolbar.handleFilterRemove(filter.field)}
                />
              }
            />
          );
        })}

        <AdminFilterAdd
          filters={filterDefinitions}
          appliedFields={toolbar.appliedFilterFields}
          onSelect={toolbar.handleFilterSelect}
        />
      </div>
    </div>
  );
}
