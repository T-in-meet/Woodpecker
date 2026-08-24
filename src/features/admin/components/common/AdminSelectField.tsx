"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";

import { ADMIN_SELECT_DEFAULTS } from "../../constants/admin-select";

export type AdminSelectFieldOption = {
  /** 화면에 표시할 옵션 이름 */
  label: string;

  /** 폼으로 전송할 옵션 값 */
  value: string;
};

type AdminSelectFieldProps = {
  /** 화면에 표시할 필드 라벨 */
  label: string;

  /** 폼 전송 시 사용할 필드 이름 */
  name: string;

  /** 선택 가능한 옵션 */
  options: AdminSelectFieldOption[];

  /** 현재 선택된 값 */
  value: string;

  /** 값이 없을 때 표시할 문구 */
  placeholder?: string;

  /** 선택 입력 비활성화 여부 */
  disabled?: boolean;

  /** 선택값 변경 함수 */
  onValueChange: (value: string) => void;
};

/**
 * 관리자 폼에서 사용하는 공통 단일 선택 필드입니다.
 *
 * @param props 컴포넌트 속성
 * @returns 라벨과 단일 선택 입력
 */
export function AdminSelectField({
  disabled = false,
  label,
  name,
  onValueChange,
  options,
  placeholder = "항목을 선택하세요.",
  value,
}: AdminSelectFieldProps) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={name}>{label}</Label>

      <input type="hidden" name={name} value={value} />

      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={name}
          className={cn(
            "w-full min-w-0 [&>span]:truncate",
            disabled &&
              "opacity-100 cursor-default bg-muted text-muted-foreground border",
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>

        <SelectContent
          {...ADMIN_SELECT_DEFAULTS.content}
          className="w-(--radix-select-trigger-width) max-w-[calc(100vw-2rem)]"
        >
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className="**:data-radix-select-item-text:min-w-0"
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
