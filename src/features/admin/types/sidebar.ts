import type { LucideIcon } from "lucide-react";

/**
 * 사이드바 메뉴 href별 badge 숫자입니다.
 *
 * 메뉴 구조에 특정 도메인 조건을 넣지 않기 위해 href를 key로 사용하며,
 * 값이 없거나 0 이하이면 badge를 표시하지 않습니다.
 */
export type AdminSidebarBadgeMap = Partial<Record<string, number>>;

export type AdminSidebarItem = {
  title: string;

  href?: string;

  icon: LucideIcon;

  breadcrumbLabel?: string;

  breadcrumbHref?: string;

  children?: readonly AdminSidebarItem[];
};
