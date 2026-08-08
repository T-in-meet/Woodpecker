"use client";

import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

import type {
  AdminAppliedFilter,
  AdminFilterDefinition,
} from "@/features/admin/types/filter";
import type { AdminListConfig } from "@/features/admin/types/list";
import type { AdminSearchValue } from "@/features/admin/types/search";
import type { AdminSort } from "@/features/admin/types/sort";
import { hasAdminFilterValue } from "@/features/admin/utils/admin-filter";

/**
 * 관리자 목록 Toolbar에서 관리하는 필터 값 모음입니다.
 */
export type AdminListToolbarFilters<TFilterField extends string> = Partial<
  Record<TFilterField, AdminAppliedFilter<TFilterField>>
>;

type UseAdminListToolbarParams<
  TSearchField extends string,
  TFilterField extends string,
  TSortField extends string,
> = {
  /** 목록에서 사용할 검색, 필터, 정렬 및 페이지네이션 설정 */
  config: AdminListConfig<TSearchField, TFilterField, TSortField>;

  /**
   * 검색, 필터 또는 정렬 조건이 적용된 후 실행할 함수입니다.
   *
   * 일반적으로 목록 페이지를 첫 페이지로 초기화할 때 사용합니다.
   */
  onApply?: () => void;
};

/**
 * 관리자 목록 Toolbar Hook이 반환하는 상태와 동작입니다.
 */
export type UseAdminListToolbarResult<
  TSearchField extends string,
  TFilterField extends string,
  TSortField extends string,
> = {
  /** 목록 조회에 사용할 적용된 검색 조건 */
  search: AdminSearchValue<TSearchField>;

  /** 목록 조회에 사용할 적용된 필터 조건 */
  filters: AdminListToolbarFilters<TFilterField>;

  /** 목록 조회에 사용할 정렬 조건 */
  sort: AdminSort<TSortField>;

  /** 사용자가 현재 입력 중인 검색 조건 */
  draftSearch: AdminSearchValue<TSearchField>;

  /** 실제 목록 조회에 적용된 검색 조건 */
  appliedSearch: AdminSearchValue<TSearchField>;

  /** Toolbar에 추가된 필터 정의 */
  selectedFilters: AdminFilterDefinition<TFilterField>[];

  /** 현재 Editor가 열린 필터 필드 */
  editingFilterField: TFilterField | null;

  /** Editor에서 편집 중인 필터 값 */
  draftFilters: AdminListToolbarFilters<TFilterField>;

  /** 실제 목록 조회에 적용된 필터 값 */
  appliedFilters: AdminListToolbarFilters<TFilterField>;

  /** Toolbar에 이미 추가된 필터 필드 목록 */
  appliedFilterFields: TFilterField[];

  /** 검색 입력 상태 변경 함수 */
  setDraftSearch: Dispatch<SetStateAction<AdminSearchValue<TSearchField>>>;

  /** 현재 편집 중인 필터 변경 함수 */
  setEditingFilterField: Dispatch<SetStateAction<TFilterField | null>>;

  /** 현재 검색 입력값을 목록 조회 조건으로 적용 */
  handleSearchApply: () => void;

  /** Toolbar에 필터 추가 */
  handleFilterSelect: (filter: AdminFilterDefinition<TFilterField>) => void;

  /** 필터의 임시 입력값 변경 */
  handleDraftFilterChange: (value: AdminAppliedFilter<TFilterField>) => void;

  /** 필터를 실제 목록 조회 조건으로 적용 */
  handleFilterApply: (field: TFilterField) => void;

  /** Toolbar에서 필터 제거 */
  handleFilterRemove: (field: TFilterField) => void;

  /** 목록 정렬 조건 변경 */
  handleSortChange: (sort: AdminSort<TSortField>) => void;
};

/**
 * 관리자 목록의 검색, 필터 및 정렬 상태를 관리합니다.
 */
export function useAdminListToolbar<
  const TSearchField extends string,
  const TFilterField extends string,
  const TSortField extends string,
>({
  config,
  onApply,
}: UseAdminListToolbarParams<
  TSearchField,
  TFilterField,
  TSortField
>): UseAdminListToolbarResult<TSearchField, TFilterField, TSortField> {
  const initialSearchField = config.search.initialField;

  const [draftSearch, setDraftSearch] = useState<
    AdminSearchValue<TSearchField>
  >({
    field: initialSearchField,
    query: "",
  });

  const [appliedSearch, setAppliedSearch] = useState<
    AdminSearchValue<TSearchField>
  >({
    field: initialSearchField,
    query: "",
  });

  const [sort, setSort] = useState<AdminSort<TSortField>>(config.initialSort);

  const [selectedFilters, setSelectedFilters] = useState<
    AdminFilterDefinition<TFilterField>[]
  >([]);

  const [editingFilterField, setEditingFilterField] =
    useState<TFilterField | null>(null);

  const [draftFilters, setDraftFilters] = useState<
    AdminListToolbarFilters<TFilterField>
  >({});

  const [appliedFilters, setAppliedFilters] = useState<
    AdminListToolbarFilters<TFilterField>
  >({});

  /**
   * 선택한 필터를 Toolbar에 추가합니다.
   */
  function handleFilterSelect(filter: AdminFilterDefinition<TFilterField>) {
    setSelectedFilters((currentFilters) => [...currentFilters, filter]);
  }

  /**
   * Editor에서 변경한 임시 필터 값을 저장합니다.
   */
  function handleDraftFilterChange(value: AdminAppliedFilter<TFilterField>) {
    setDraftFilters((currentFilters) => ({
      ...currentFilters,
      [value.field]: value,
    }));
  }

  /**
   * 지정한 필터를 선택 목록과 임시·적용 값에서 제거합니다.
   */
  function handleFilterRemove(field: TFilterField) {
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

    setEditingFilterField((currentField) =>
      currentField === field ? null : currentField,
    );

    onApply?.();
  }

  /**
   * 지정한 임시 필터 값을 실제 목록 조회 조건으로 적용합니다.
   */
  function handleFilterApply(field: TFilterField) {
    const draftFilter = draftFilters[field];

    setAppliedFilters((currentFilters) => {
      const nextFilters = { ...currentFilters };

      if (!draftFilter || !hasAdminFilterValue(draftFilter)) {
        delete nextFilters[field];

        return nextFilters;
      }

      nextFilters[field] = draftFilter;

      return nextFilters;
    });

    onApply?.();
  }

  /**
   * 현재 검색 입력값을 실제 목록 조회 조건으로 적용합니다.
   */
  function handleSearchApply() {
    const normalizedSearch: AdminSearchValue<TSearchField> = {
      ...draftSearch,
      query: draftSearch.query.trim(),
    };

    setDraftSearch(normalizedSearch);
    setAppliedSearch(normalizedSearch);

    onApply?.();
  }

  /**
   * 목록에 적용할 정렬 조건을 변경합니다.
   */
  function handleSortChange(nextSort: AdminSort<TSortField>) {
    setSort(nextSort);
    onApply?.();
  }

  const appliedFilterFields = selectedFilters.map((filter) => filter.field);

  return {
    search: appliedSearch,
    filters: appliedFilters,
    sort,

    draftSearch,
    appliedSearch,
    selectedFilters,
    editingFilterField,
    draftFilters,
    appliedFilters,
    appliedFilterFields,

    setDraftSearch,
    setEditingFilterField,

    handleSearchApply,
    handleFilterSelect,
    handleDraftFilterChange,
    handleFilterApply,
    handleFilterRemove,
    handleSortChange,
  };
}
