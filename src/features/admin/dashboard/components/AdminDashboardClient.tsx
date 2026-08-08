"use client";

import { AdminPageHeader } from "../../components/layout/AdminPageHeader";

export function AdminDashboardClient() {
  return (
    <div className="">
      <AdminPageHeader
        title="Dashboard"
        description="Woodpecker 관리자 대시보드입니다."
      />
    </div>
  );
}
