"use client";

import { AdminPageHeader } from "@/features/admin/components/layout/AdminPageHeader";

export function AdminNoteRelationPromptsClient() {
  return (
    <div>
      <AdminPageHeader
        title="프롬프트"
        description="노트 연결에 사용하는 프롬프트를 관리합니다."
      />
    </div>
  );
}
