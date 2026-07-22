import type { ReactNode } from "react";

import { Header } from "@/components/layout/Header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AdminHeader } from "@/features/admin/components/layout/AdminHeader";
import { AdminSidebar } from "@/features/admin/components/layout/AdminSidebar";

interface Props {
  children: ReactNode;
}

export default function AdminLayout({ children }: Props) {
  return (
    <>
      <Header />

      <div className="min-h-[calc(100vh-var(--header-height))]">
        <SidebarProvider>
          <AdminSidebar />

          <SidebarInset className="@container min-w-0">
            <AdminHeader />

            <main className="min-w-0 flex-1 overflow-auto p-6">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </>
  );
}
