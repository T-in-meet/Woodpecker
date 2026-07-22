"use client";

import { usePathname } from "next/navigation";

import { ADMIN_SIDEBAR_ITEMS } from "../../constants/admin-sidebar-items";
import { getAdminBreadcrumbItems } from "../../utils/admin-breadcrumb";
import { AdminBreadcrumb } from "./AdminBreadcrumb";

export function AdminBreadcrumbNavigation() {
  const pathname = usePathname();

  const items = getAdminBreadcrumbItems(ADMIN_SIDEBAR_ITEMS, pathname);

  if (items.length === 0) {
    return null;
  }

  return <AdminBreadcrumb items={items} />;
}
