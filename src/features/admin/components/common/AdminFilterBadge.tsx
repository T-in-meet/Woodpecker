"use client";

import { X } from "lucide-react";
import { forwardRef, type MouseEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface AdminFilterBadgeProps extends React.ComponentPropsWithoutRef<
  typeof Badge
> {
  /** 사용자에게 표시할 필터 필드명 */
  label: string;

  /** 필터를 삭제할 때 호출되는 함수 */
  onRemove: () => void;
}

/**
 * 관리자 목록에 적용된 필터를 표시하는 공통 Badge입니다.
 *
 * Badge에는 필터 값이 아닌 필드명만 표시합니다.
 *
 * 컴포넌트 전체는 `PopoverTrigger asChild`의 자식으로 사용할 수 있도록
 * 전달받은 ref와 HTML 속성을 최상위 Badge에 적용합니다.
 *
 * 삭제 버튼은 Popover Trigger와 별도의 동작으로 처리되며,
 * 삭제 시 Popover가 열리지 않도록 이벤트 전파를 중단합니다.
 *
 * @param props 필터 이름과 삭제 처리 함수
 * @param ref Popover Trigger가 최상위 Badge에 전달하는 ref
 * @returns 적용된 관리자 필터 Badge
 */
export const AdminFilterBadge = forwardRef<
  React.ElementRef<typeof Badge>,
  AdminFilterBadgeProps
>(function AdminFilterBadge({ label, onRemove, className, ...props }, ref) {
  /**
   * 필터를 삭제하고 Popover Trigger 동작을 차단합니다.
   *
   * @param event 삭제 버튼 클릭 이벤트
   */
  function handleRemove(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    onRemove();
  }

  return (
    <Badge
      ref={ref}
      variant="secondary"
      className={cn(
        "h-8 cursor-pointer gap-1 px-1 py-0",
        "hover:bg-secondary/80",
        className,
      )}
      {...props}
    >
      {/* Badge 영역 클릭은 Popover Trigger가 처리합니다. */}
      <span className="px-2">{label}</span>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 rounded-full"
        aria-label={`${label} 필터 삭제`}
        onClick={handleRemove}
      >
        <X className="size-3" aria-hidden="true" />
      </Button>
    </Badge>
  );
});
