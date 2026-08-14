"use client";

import Link from "next/link";

import { AdminPageHeader } from "../../components/layout/AdminPageHeader";
import { ADMIN_PAGES } from "../constants/page";

/**
 * 관리자 주요 관리 영역으로 이동할 수 있는 대시보드를 렌더링합니다.
 *
 * @returns 관리자 대시보드
 */
export function AdminDashboardClient() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dashboard"
        description="Woodpecker 관리자 대시보드입니다."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ADMIN_PAGES.map((item) => {
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-lg border border-border/70 bg-card p-5 text-card-foreground transition-all hover:-translate-y-0.5 hover:border-blue-500/15 hover:bg-blue-500/3 hover:shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="rounded-md border p-2">
                  <Icon className="size-5" aria-hidden="true" />
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold transition-colors group-hover:text-primary">
                    {item.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
