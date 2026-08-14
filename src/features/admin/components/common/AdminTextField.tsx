import type { ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils/cn";

type AdminTextFieldProps = ComponentProps<typeof Input> & {
  /** 화면에 표시할 필드 라벨 */
  label: string;

  /** 폼 전송 시 사용할 필드 이름 */
  name: string;
};

/**
 * 관리자 페이지에서 공통으로 사용하는 텍스트 입력 필드입니다.
 *
 * @param props 컴포넌트 속성
 * @returns 라벨을 포함한 텍스트 입력 필드
 */
export function AdminTextField({
  id,
  label,
  name,
  ...inputProps
}: AdminTextFieldProps) {
  const fieldId = id ?? name;

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        id={fieldId}
        name={name}
        className={cn(
          inputProps.className,
          inputProps.readOnly && "bg-muted text-muted-foreground",
        )}
        {...inputProps}
      />
    </div>
  );
}
