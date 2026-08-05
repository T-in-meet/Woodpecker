"use client";

import { AdminPageHeader } from "@/features/admin/components/layout/AdminPageHeader";

export function AdminKnowledgeObjectsClient() {
  return (
    <div>
      <AdminPageHeader
        title="지식 객체"
        description="생성된 지식 객체를 조회하고 관리합니다."
      />
    </div>
  );
}
