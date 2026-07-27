"use client";

import { AdminPageHeader } from "@/features/admin/components/layout/AdminPageHeader";

export function AdminExperimentsDashboardClient() {
  return (
    <div>
      <AdminPageHeader
        title="실험 기능 대시보드"
        description="실험 기능의 전체 현황을 확인합니다."
      />
    </div>
  );
}
