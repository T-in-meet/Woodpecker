import { ROUTES } from "@/lib/constants/routes";

import type { AdminBreadcrumbItem } from "../types/breadcrumb";
import type { AdminSidebarItem } from "../types/sidebar";

interface BreadcrumbMatch {
  items: AdminBreadcrumbItem[];
  matchedHrefLength: number;
}

function isPathMatch(pathname: string, href?: string) {
  if (!href) {
    return false;
  }

  if (href === ROUTES.ADMIN.DASHBOARD) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function findBreadcrumbMatch(
  items: readonly AdminSidebarItem[],
  pathname: string,
  parents: AdminBreadcrumbItem[] = [],
): BreadcrumbMatch | null {
  let bestMatch: BreadcrumbMatch | null = null;

  for (const item of items) {
    const currentItem: AdminBreadcrumbItem = item.href
      ? {
          label: item.title,
          href: item.href,
        }
      : {
          label: item.title,
        };

    const currentPath = [...parents, currentItem];

    if (isPathMatch(pathname, item.href)) {
      bestMatch = {
        items: currentPath,
        matchedHrefLength: item.href?.length ?? 0,
      };
    }

    if (item.children?.length) {
      const childMatch = findBreadcrumbMatch(
        item.children,
        pathname,
        currentPath,
      );

      if (
        childMatch &&
        (!bestMatch ||
          childMatch.matchedHrefLength > bestMatch.matchedHrefLength)
      ) {
        bestMatch = childMatch;
      }
    }
  }

  return bestMatch;
}

export function getAdminBreadcrumbItems(
  items: readonly AdminSidebarItem[],
  pathname: string,
): AdminBreadcrumbItem[] {
  return findBreadcrumbMatch(items, pathname)?.items ?? [];
}
