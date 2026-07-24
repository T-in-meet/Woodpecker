"use client";

import { usePathname } from "next/navigation";

import { ADMIN_SIDEBAR_ITEMS } from "../../constants/admin-sidebar-items";
import { useAdminBreadcrumb } from "../../contexts/AdminBreadcrumbContext";
import { getAdminBreadcrumbItems } from "../../utils/admin-breadcrumb";
import { AdminBreadcrumb } from "./AdminBreadcrumb";

/**
 * 현재 관리자 경로와 개별 페이지가 등록한 동적 항목을 조합하여
 * 관리자 Breadcrumb을 표시합니다.
 */
export function AdminBreadcrumbNavigation() {
  const pathname = usePathname();
  const { dynamicItems, isDynamicItemsLoading, dynamicLoadingItemCount } =
    useAdminBreadcrumb();

  const staticItems = getAdminBreadcrumbItems(ADMIN_SIDEBAR_ITEMS, pathname);

  const items = [...staticItems, ...dynamicItems];

  if (items.length === 0 && !isDynamicItemsLoading) {
    return null;
  }

  return (
    <AdminBreadcrumb
      items={items}
      loading={isDynamicItemsLoading}
      loadingItemCount={dynamicLoadingItemCount}
    />
  );
}
