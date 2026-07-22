"use client";

import { AdminPageHeader } from "../../components/layout/AdminPageHeader";

export function AdminFeedbackClient() {
  return (
    <div>
      <AdminPageHeader
        title="사용자 피드백"
        description="사용자가 전달한 피드백을 조회하고 관리합니다."
      />
    </div>
  );
}
