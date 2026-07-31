"use client";

import { X } from "lucide-react";
import {
  type ComponentPropsWithoutRef,
  type ElementRef,
  forwardRef,
  type MouseEvent,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type AdminFilterBadgeProps = ComponentPropsWithoutRef<typeof Badge> & {
  /** 사용자에게 표시할 필터 필드명 */
  label: string;

  /** 필터 값이 설정되어 실제 조회 조건으로 사용되는지 여부 */
  isActive: boolean;

  /** 필터를 삭제할 때 호출되는 함수 */
  onRemove: () => void;
};

/**
 * 관리자 목록에 추가된 필터를 표시하는 공통 Badge입니다.
 *
 * Badge에는 필터 값이 아닌 필드명만 표시합니다.
 *
 * 값이 설정된 필터는 secondary 스타일로,
 * 값이 설정되지 않은 필터는 outline 스타일로 구분합니다.
 *
 * 컴포넌트 전체는 `PopoverTrigger asChild`의 자식으로 사용할 수 있도록
 * 전달받은 ref와 HTML 속성을 최상위 Badge에 적용합니다.
 *
 * @param props 필터 이름, 활성 상태 및 삭제 처리 함수
 * @param ref Popover Trigger가 최상위 Badge에 전달하는 ref
 * @returns 관리자 필터 Badge
 */
export const AdminFilterBadge = forwardRef<
  ElementRef<typeof Badge>,
  AdminFilterBadgeProps
>(function AdminFilterBadge(
  { label, isActive, onRemove, className, ...props },
  ref,
) {
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
      variant={isActive ? "secondary" : "outline"}
      className={cn(
        "h-8 cursor-pointer gap-1 px-1 py-0",
        "hover:bg-secondary/80",
        !isActive && "text-muted-foreground",
        className,
      )}
      aria-label={`${label} 필터${isActive ? "" : ", 값 미설정"}`}
      {...props}
    >
      {/* Badge에는 필터 값이 아닌 필드명만 표시합니다. */}
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
