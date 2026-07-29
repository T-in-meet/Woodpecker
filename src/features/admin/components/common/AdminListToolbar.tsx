"use client";

import { AdminFilterAdd } from "@/features/admin/components/common/AdminFilterAdd";
import { AdminFilterBadge } from "@/features/admin/components/common/AdminFilterBadge";
import { AdminFilterEditor } from "@/features/admin/components/common/AdminFilterEditor";
import { AdminSearch } from "@/features/admin/components/common/AdminSearch";
import type { UseAdminListToolbarResult } from "@/features/admin/hooks/use-admin-list-toolbar";
import type { AdminListConfig } from "@/features/admin/types/list";
import { hasAdminFilterValue } from "@/features/admin/utils/admin-filter";

type AdminListToolbarProps<
  TSearchField extends string,
  TFilterField extends string,
  TSortField extends string,
> = {
  /** 관리자 목록에서 사용할 검색, 필터 및 페이지네이션 설정 */
  config: AdminListConfig<TSearchField, TFilterField, TSortField>;

  /** 검색과 필터 상태 및 처리 함수 */
  toolbar: UseAdminListToolbarResult<TSearchField, TFilterField, TSortField>;
};

/**
 * 관리자 목록에서 사용하는 공통 검색 및 필터 Toolbar입니다.
 *
 * 검색 입력, 필터 추가, 필터 Editor 렌더링을 내부에서 조합하여
 * 각 목록 페이지에서 반복되는 상태 연결 코드를 줄입니다.
 */
export function AdminListToolbar<
  TSearchField extends string,
  TFilterField extends string,
  TSortField extends string,
>({
  config,
  toolbar,
}: AdminListToolbarProps<TSearchField, TFilterField, TSortField>) {
  const searchFields = config.search.fields;
  const filterDefinitions = config.filters;

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
