"use client";

import { AdminPageHeader } from "../../components/layout/AdminPageHeader";

export function AdminUsersClient() {
  return (
    <div>
      <AdminPageHeader
        title="사용자"
        description="서비스 사용자를 조회하고 관리합니다."
      />
    </div>
  );
}
