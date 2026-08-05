"use client";

import { AdminPageHeader } from "@/features/admin/components/layout/AdminPageHeader";

export function AdminNoteRelationsClient() {
  return (
    <div>
      <AdminPageHeader
        title="노트 관계"
        description="노트 간의 관계를 조회하고 관리합니다."
      />
    </div>
  );
}
