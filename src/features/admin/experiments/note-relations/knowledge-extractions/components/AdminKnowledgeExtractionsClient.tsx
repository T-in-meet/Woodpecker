"use client";

import { AdminPageHeader } from "@/features/admin/components/layout/AdminPageHeader";

export function AdminKnowledgeExtractionsClient() {
  return (
    <div>
      <AdminPageHeader
        title="지식 추출"
        description="노트에서 추출한 지식 데이터를 확인하고 관리합니다."
      />
    </div>
  );
}
