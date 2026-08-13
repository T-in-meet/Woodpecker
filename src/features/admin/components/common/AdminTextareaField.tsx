import type { ComponentProps } from "react";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";

type AdminTextareaFieldProps = ComponentProps<typeof Textarea> & {
  /** 화면에 표시할 필드 라벨 */
  label: string;

  /** 폼 전송 시 사용할 필드 이름 */
  name: string;
};

/**
 * 관리자 페이지에서 공통으로 사용하는 여러 줄 입력 필드입니다.
 *
 * @param props 컴포넌트 속성
 * @returns 라벨을 포함한 여러 줄 입력 필드
 */
export function AdminTextareaField({
  id,
  label,
  name,
  ...textareaProps
}: AdminTextareaFieldProps) {
  const fieldId = id ?? name;

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{label}</Label>
      <Textarea
        id={fieldId}
        name={name}
        className={cn(
          textareaProps.className,
          textareaProps.readOnly && "bg-muted text-muted-foreground",
        )}
        {...textareaProps}
      />
    </div>
  );
}
