"use client";

import { Search } from "lucide-react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ADMIN_SELECT_DEFAULTS } from "../../constants/admin-select";
import type { AdminSearchField, AdminSearchValue } from "../../types/search";

interface AdminSearchProps<TField extends string> {
  /** 검색에서 선택할 수 있는 필드 목록 */
  fields: readonly AdminSearchField<TField>[];

  /** 현재 편집 중인 검색 필드와 검색어 */
  value: AdminSearchValue<TField>;

  /** 검색 입력 상태가 변경될 때 호출되는 함수 */
  onChange: (value: AdminSearchValue<TField>) => void;

  /** 사용자가 검색 버튼을 누르거나 Enter를 입력했을 때 호출되는 함수 */
  onSearch: () => void;

  /** 검색어 입력창에 표시할 안내 문구 */
  placeholder?: string;

  /** 검색 필드 Select의 접근성 이름 */
  fieldAriaLabel?: string;

  /** 검색어 Input의 접근성 이름 */
  queryAriaLabel?: string;

  /** 검색 버튼의 접근성 이름 */
  searchButtonAriaLabel?: string;
}

/**
 * 관리자 목록에서 검색 필드와 검색어를 입력하는 공통 컴포넌트입니다.
 *
 * 검색 가능한 필드와 현재 검색 입력 상태를 외부에서 주입받는
 * 제어 컴포넌트입니다.
 *
 * 사용자가 검색 버튼을 누르거나 검색어 Input에서 Enter를 입력하면
 * `onSearch`를 호출합니다.
 *
 * 데이터 조회와 페이지 초기화는 상위 컴포넌트에서 처리합니다.
 *
 * @template TField 검색 가능한 필드의 문자열 리터럴 타입
 * @param props 검색 필드, 검색 입력 상태 및 검색 이벤트
 * @returns 검색 필드 Select, 검색어 Input 및 검색 버튼
 */
export function AdminSearch<TField extends string>({
  fields,
  value,
  onChange,
  onSearch,
  placeholder = "검색어를 입력하세요.",
  fieldAriaLabel = "검색 필드 선택",
  queryAriaLabel = "검색어 입력",
  searchButtonAriaLabel = "검색",
}: AdminSearchProps<TField>) {
  /**
   * 검색 필드를 변경하고 기존 검색어는 유지합니다.
   *
   * @param field 새로 선택한 검색 필드
   */
  function handleFieldChange(field: TField) {
    onChange({
      ...value,
      field,
    });
  }

  /**
   * 검색어를 변경하고 현재 선택된 검색 필드는 유지합니다.
   *
   * @param query 새로 입력한 검색어
   */
  function handleQueryChange(query: string) {
    onChange({
      ...value,
      query,
    });
  }

  /**
   * 검색 Form 제출 시 브라우저 기본 동작을 막고
   * 상위 컴포넌트에 검색 실행을 요청합니다.
   *
   * @param event 검색 Form 제출 이벤트
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    onSearch();
  }

  return (
    <form
      className="flex w-full flex-col gap-2 sm:flex-row sm:items-center"
      role="search"
      aria-label="관리자 목록 검색"
      onSubmit={handleSubmit}
    >
      {/* 검색 필드의 종류는 각 관리자 목록 페이지에서 주입합니다. */}
      <Select value={value.field} onValueChange={handleFieldChange}>
        <SelectTrigger className="w-full sm:w-40" aria-label={fieldAriaLabel}>
          <SelectValue />
        </SelectTrigger>

        <SelectContent {...ADMIN_SELECT_DEFAULTS.content}>
          {fields.map((field) => (
            <SelectItem key={field.value} value={field.value}>
              {field.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 검색어 변경은 편집 상태만 갱신하며 실제 검색은 제출 시 실행합니다. */}
      <Input
        type="search"
        value={value.query}
        placeholder={placeholder}
        aria-label={queryAriaLabel}
        onChange={(event) => handleQueryChange(event.target.value)}
      />

      <Button
        type="submit"
        className="shrink-0"
        aria-label={searchButtonAriaLabel}
      >
        <Search aria-hidden="true" />
        검색
      </Button>
    </form>
  );
}
