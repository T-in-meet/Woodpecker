"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";

import { AdminBreadcrumbNavigation } from "./AdminBreadcrumbNavigation";

export function AdminHeader() {
  return (
    <header className="flex items-center border-b pl-5 pr-6">
      <div className="flex items-center gap-2">
        <SidebarTrigger />

        <AdminBreadcrumbNavigation />
      </div>
    </header>
  );
}
