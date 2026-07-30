import { ROUTES } from "@/lib/constants/routes";

import type { AdminSidebarBadgeMap, AdminSidebarItem } from "../types/sidebar";

export type OpenGroups = Record<number, string>;

export function isPathActive(pathname: string, href?: string) {
  if (!href) {
    return false;
  }

  if (href === ROUTES.ADMIN.DASHBOARD) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function hasActiveItem(
  pathname: string,
  item: AdminSidebarItem,
): boolean {
  if (isPathActive(pathname, item.href)) {
    return true;
  }

  return (
    item.children?.some((child) => hasActiveItem(pathname, child)) ?? false
  );
}

export function getItemKey(item: AdminSidebarItem, depth: number) {
  return `${depth}-${item.title}-${item.href ?? "group"}`;
}

/**
 * 메뉴 항목의 href에 매칭되는 badge 숫자를 반환합니다.
 *
 * group item처럼 href가 없거나 숫자가 0 이하인 경우에는 표시 대상이 아니므로 0을 반환합니다.
 */
export function getSidebarBadgeCount(
  item: AdminSidebarItem,
  badgeMap: AdminSidebarBadgeMap | undefined,
) {
  if (!item.href) return 0;

  const count = badgeMap?.[item.href] ?? 0;

  return count > 0 ? count : 0;
}

/**
 * 사이드바 badge에 표시할 짧은 숫자 문자열을 만듭니다.
 */
export function formatSidebarBadgeCount(count: number) {
  if (count <= 0) return null;

  return count > 99 ? "99+" : String(count);
}

export function getActiveGroups(
  items: readonly AdminSidebarItem[],
  pathname: string,
  depth = 0,
): OpenGroups {
  for (const item of items) {
    const children = item.children;

    if (!children?.length) {
      continue;
    }

    if (!children.some((child) => hasActiveItem(pathname, child))) {
      continue;
    }

    return {
      [depth]: getItemKey(item, depth),
      ...getActiveGroups(children, pathname, depth + 1),
    };
  }

  return {};
}
