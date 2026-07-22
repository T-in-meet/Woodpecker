import { ROUTES } from "@/lib/constants/routes";

import type { AdminSidebarItem } from "../types/sidebar";

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
