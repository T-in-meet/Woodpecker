"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { ROUTES } from "@/lib/constants/routes";

import { ADMIN_SIDEBAR_ITEMS } from "../../constants/admin-sidebar-items";
import { useAdminUnreadNotificationCounts } from "../../notifications/hooks/use-admin-unread-notification-counts";
import type { AdminSidebarBadgeMap } from "../../types/sidebar";
import {
  getActiveGroups,
  getItemKey,
  OpenGroups,
} from "../../utils/admin-sidebar";
import { AdminSidebarMenuItem } from "./AdminSidebarMenuItem";

export function AdminSidebarNavigation() {
  const pathname = usePathname();
  const { data: unreadNotificationCounts } = useAdminUnreadNotificationCounts();

  const { setOpenMobile } = useSidebar();

  const [openGroups, setOpenGroups] = useState<OpenGroups>(() =>
    getActiveGroups(ADMIN_SIDEBAR_ITEMS, pathname),
  );

  useEffect(() => {
    const activeGroups = getActiveGroups(ADMIN_SIDEBAR_ITEMS, pathname);

    if (Object.keys(activeGroups).length > 0) {
      setOpenGroups(activeGroups);
    }
  }, [pathname]);

  function handleOpenChange(depth: number, itemKey: string, open: boolean) {
    setOpenGroups((previous) => {
      const next = { ...previous };

      Object.keys(next).forEach((key) => {
        const currentDepth = Number(key);

        if (currentDepth >= depth) {
          delete next[currentDepth];
        }
      });

      if (open) {
        next[depth] = itemKey;
      }

      return next;
    });
  }

  function handleNavigate() {
    setOpenMobile(false);
  }

  const badgeMap = useMemo<AdminSidebarBadgeMap>(
    () => ({
      [ROUTES.ADMIN.FEEDBACKS]: unreadNotificationCounts?.FEEDBACK_CREATED,
      [ROUTES.ADMIN.OPERATIONAL_ERRORS]:
        unreadNotificationCounts?.OPERATIONAL_ERROR,
    }),
    [
      unreadNotificationCounts?.FEEDBACK_CREATED,
      unreadNotificationCounts?.OPERATIONAL_ERROR,
    ],
  );

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>관리자 메뉴</SidebarGroupLabel>

        <SidebarGroupContent>
          <SidebarMenu>
            {ADMIN_SIDEBAR_ITEMS.map((item) => (
              <AdminSidebarMenuItem
                key={getItemKey(item, 0)}
                badgeMap={badgeMap}
                item={item}
                pathname={pathname}
                openGroups={openGroups}
                onOpenChange={handleOpenChange}
                onNavigate={handleNavigate}
              />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  );
}
