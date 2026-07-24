import type { ReactNode } from "react";

import { Header } from "@/components/layout/Header";
import { SidebarInset } from "@/components/ui/sidebar";
import { AdminBodyOverflowLock } from "@/features/admin/components/layout/AdminBodyOverflowLock";
import { AdminHeader } from "@/features/admin/components/layout/AdminHeader";
import { AdminSidebar } from "@/features/admin/components/layout/AdminSidebar";
import { AdminSidebarProvider } from "@/features/admin/components/layout/AdminSidebarProvider";

interface Props {
  children: ReactNode;
}

export default function AdminLayout({ children }: Props) {
  return (
    <>
      <Header />
      <AdminBodyOverflowLock />

      <div className="h-[calc(100vh-var(--header-height))] overflow-hidden">
        <AdminSidebarProvider className="h-full min-h-0">
          <AdminSidebar />

          <SidebarInset className="@container flex h-full min-w-0 flex-col">
            <AdminHeader />

            <main className="min-h-0 min-w-0 flex-1 overflow-auto p-6">
              {children}
            </main>
          </SidebarInset>
        </AdminSidebarProvider>
      </div>
    </>
  );
}
