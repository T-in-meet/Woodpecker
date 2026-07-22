import { ROUTES } from "@/lib/constants/routes";

import type { AdminBreadcrumbItem } from "../types/breadcrumb";
import type { AdminSidebarItem } from "../types/sidebar";

interface BreadcrumbMatch {
  items: AdminBreadcrumbItem[];
  matchedHrefLength: number;
}

/**
 * 현재 경로가 Sidebar 항목의 경로와 일치하는지 확인한다.
 */
function isPathMatch(pathname: string, href?: string) {
  if (!href) {
    return false;
  }

  if (href === ROUTES.ADMIN.DASHBOARD) {
    return pathname === href;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * 현재 경로와 가장 구체적으로 일치하는 Breadcrumb 경로를 찾는다.
 */
function findBreadcrumbMatch(
  items: readonly AdminSidebarItem[],
  pathname: string,
  parents: AdminBreadcrumbItem[] = [],
): BreadcrumbMatch | null {
  let bestMatch: BreadcrumbMatch | null = null;

  for (const item of items) {
    // href가 있는 항목만 Breadcrumb에 포함한다.
    const currentPath = item.href
      ? [
          ...parents,
          {
            label: item.breadcrumbLabel ?? item.title,
            href: item.href,
          },
        ]
      : parents;

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

      // 가장 긴 href를 우선하여 가장 구체적인 경로를 선택한다.
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

/**
 * 현재 경로에 해당하는 관리자 Breadcrumb 목록을 반환한다.
 *
 * 관리자 대시보드(/admin)를 제외한 모든 관리자 페이지에는
 * 대시보드를 Breadcrumb의 최상위 항목으로 추가한다.
 */
export function getAdminBreadcrumbItems(
  items: readonly AdminSidebarItem[],
  pathname: string,
): AdminBreadcrumbItem[] {
  const matchedItems = findBreadcrumbMatch(items, pathname)?.items ?? [];

  if (pathname === ROUTES.ADMIN.DASHBOARD) {
    return matchedItems;
  }

  const dashboardItem = items.find(
    (item) => item.href === ROUTES.ADMIN.DASHBOARD,
  );

  if (!dashboardItem) {
    return matchedItems;
  }

  // 관리자 페이지에서는 항상 대시보드를 Breadcrumb의 시작점으로 사용한다.
  return [
    {
      label: dashboardItem.title,
      href: ROUTES.ADMIN.DASHBOARD,
    },
    ...matchedItems,
  ];
}
