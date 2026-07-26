import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { Header } from "@/components/layout/Header";
import { SidebarInset } from "@/components/ui/sidebar";
import { AdminBodyOverflowLock } from "@/features/admin/components/layout/AdminBodyOverflowLock";
import { AdminHeader } from "@/features/admin/components/layout/AdminHeader";
import { AdminSidebar } from "@/features/admin/components/layout/AdminSidebar";
import { AdminSidebarProvider } from "@/features/admin/components/layout/AdminSidebarProvider";
import { ADMIN_SIDEBAR_DEFAULT_OPEN } from "@/features/admin/constants/admin-sidebar";
import { AdminBreadcrumbProvider } from "@/features/admin/contexts/AdminBreadcrumbContext";
import { requireAdmin } from "@/features/admin/utils/require-admin";
import { ROUTES } from "@/lib/constants/routes";

const SIDEBAR_COOKIE_NAME = "sidebar_state";

interface Props {
  children: ReactNode;
}

export default async function AdminLayout({ children }: Props) {
  try {
    await requireAdmin();
  } catch {
    redirect(ROUTES.HOME);
  }

  const cookieStore = await cookies();
  const storedSidebarOpen = cookieStore.get(SIDEBAR_COOKIE_NAME)?.value;

  const defaultOpen =
    storedSidebarOpen === undefined
      ? ADMIN_SIDEBAR_DEFAULT_OPEN
      : storedSidebarOpen === "true";

  return (
    <>
      <Header />
      <AdminBodyOverflowLock />

      <div className="h-[calc(100vh-var(--header-height))] overflow-hidden">
        <AdminSidebarProvider
          className="h-full min-h-0"
          defaultOpen={defaultOpen}
        >
          <AdminSidebar />

          <AdminBreadcrumbProvider>
            <SidebarInset className="@container flex h-full min-w-0 flex-col">
              <AdminHeader />

              <main className="min-h-0 min-w-0 flex-1 overflow-auto p-6">
                {children}
              </main>
            </SidebarInset>
          </AdminBreadcrumbProvider>
        </AdminSidebarProvider>
      </div>
    </>
  );
}
