"use client";

import Link from "next/link";

import { AdminPageHeader } from "@/features/admin/components/layout/AdminPageHeader";
import { ROUTES } from "@/lib/constants/routes";

import { EXPERIMENT_PAGES } from "../constants/page";

export function AdminExperimentsDashboardClient() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="실험 기능 대시보드"
        description="실험 기능의 전체 현황을 확인합니다."
        backLabel="대시보드"
        backHref={ROUTES.ADMIN.DASHBOARD}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {EXPERIMENT_PAGES.map((experiment) => (
          <Link
            key={experiment.href}
            href={experiment.href}
            className="group rounded-lg border border-border/70 p-6 transition-all hover:-translate-y-0.5 hover:border-blue-500/15 hover:bg-blue-500/3 hover:shadow-sm"
          >
            <h2 className="font-semibold transition-colors group-hover:text-primary">
              {experiment.title}
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              {experiment.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
