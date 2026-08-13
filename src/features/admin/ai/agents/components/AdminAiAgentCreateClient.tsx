"use client";

import { AdminBreadcrumbDynamicItems } from "@/features/admin/components/layout/AdminBreadcrumbDynamicItems";
import { AdminDetailPageHeader } from "@/features/admin/components/layout/AdminDetailPageHeader";
import { ROUTES } from "@/lib/constants/routes";

import { AdminAiAgentForm } from "./AdminAiAgentForm";

/**
 * 관리자 AI Agent 생성 페이지를 렌더링합니다.
 *
 * @returns 관리자 AI Agent 생성 화면
 */
export function AdminAiAgentCreateClient() {
  return (
    <div className="space-y-6">
      <AdminBreadcrumbDynamicItems
        items={[
          {
            label: "새 에이전트 생성",
          },
        ]}
      />
      <AdminDetailPageHeader
        title="AI Agent 추가"
        description="Agent는 기능 코드가 참조하는 실행 슬롯이며 key는 생성 후 변경할 수 없습니다."
        backHref={ROUTES.ADMIN.AI.AGENTS}
        backLabel="Agent 목록"
      />

      <AdminAiAgentForm />
    </div>
  );
}
