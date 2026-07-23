"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { AdminSearchField, AdminSearchValue } from "../../types/search";

interface AdminSearchProps<TField extends string> {
  /** 검색에서 선택할 수 있는 필드 목록 */
  fields: readonly AdminSearchField<TField>[];

  /** 현재 선택된 검색 필드와 검색어 */
  value: AdminSearchValue<TField>;

  /** 검색 상태가 변경될 때 호출되는 함수 */
  onChange: (value: AdminSearchValue<TField>) => void;

  /** 검색어 입력창에 표시할 안내 문구 */
  placeholder?: string;

  /** 검색 필드 Select의 접근성 이름 */
  fieldAriaLabel?: string;

  /** 검색어 Input의 접근성 이름 */
  queryAriaLabel?: string;
}

/**
 * 관리자 목록에서 검색 필드와 검색어를 입력하는 공통 컴포넌트입니다.
 *
 * 검색 가능한 필드와 현재 검색 상태를 외부에서 주입받는 제어 컴포넌트이며,
 * 데이터 조회, 디바운스, 페이지 초기화 등의 로직은 담당하지 않습니다.
 *
 * @template TField 검색 가능한 필드의 문자열 리터럴 타입
 * @param props 검색 필드 및 검색 상태
 * @returns 검색 필드 Select와 검색어 Input
 */
export function AdminSearch<TField extends string>({
  fields,
  value,
  onChange,
  placeholder = "검색어를 입력하세요.",
  fieldAriaLabel = "검색 필드 선택",
  queryAriaLabel = "검색어 입력",
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

  return (
    <div
      className="flex w-full flex-col gap-2 sm:flex-row"
      role="search"
      aria-label="관리자 목록 검색"
    >
      {/* 검색 필드의 종류는 각 관리자 목록 페이지에서 주입합니다. */}
      <Select value={value.field} onValueChange={handleFieldChange}>
        <SelectTrigger className="w-full sm:w-40" aria-label={fieldAriaLabel}>
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          {fields.map((field) => (
            <SelectItem key={field.value} value={field.value}>
              {field.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* 검색어 입력은 조회 방식과 무관한 제어 Input으로 유지합니다. */}
      <Input
        type="search"
        value={value.query}
        placeholder={placeholder}
        aria-label={queryAriaLabel}
        onChange={(event) => handleQueryChange(event.target.value)}
      />
    </div>
  );
}
