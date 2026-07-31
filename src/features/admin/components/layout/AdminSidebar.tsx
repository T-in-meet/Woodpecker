"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
} from "@/components/ui/sidebar";

import { AdminSidebarFooter } from "./AdminSidebarFooter";
import { AdminSidebarHeader } from "./AdminSidebarHeader";
import { AdminSidebarNavigation } from "./AdminSidebarNavigation";

export function AdminSidebar() {
  return (
    <Sidebar className="md:top-17.5! md:h-[calc(100svh-70px)]!">
      <AdminSidebarHeader />

      <SidebarContent>
        <AdminSidebarNavigation />
      </SidebarContent>

      <SidebarFooter>
        <AdminSidebarFooter />
      </SidebarFooter>
    </Sidebar>
  );
}
