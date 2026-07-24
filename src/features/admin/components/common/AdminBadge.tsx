import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

import type { AdminBadgeColor } from "../../types/badge";

interface AdminBadgeProps extends Omit<
  ComponentProps<typeof Badge>,
  "variant"
> {
  /** 관리자 배지에 적용할 색상 */
  color?: AdminBadgeColor;
}

const ADMIN_BADGE_COLOR_CLASS_NAME: Record<AdminBadgeColor, string> = {
  gray: "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200",
  blue: "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  green:
    "border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300",
  yellow:
    "border-yellow-200 bg-yellow-100 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  red: "border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  purple:
    "border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300",
};

/**
 * 관리자 페이지에서 사용하는 공통 배지 컴포넌트입니다.
 *
 * 배지의 의미와 표시 문구는 각 기능의 config에서 결정하고,
 * 이 컴포넌트는 전달받은 색상 스타일만 적용합니다.
 */
export function AdminBadge({
  color = "gray",
  className,
  ...props
}: AdminBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(ADMIN_BADGE_COLOR_CLASS_NAME[color], className)}
      {...props}
    />
  );
}
