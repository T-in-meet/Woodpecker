"use client";

import { AdminBreadcrumbDynamicItems } from "@/features/admin/components/layout/AdminBreadcrumbDynamicItems";
import { AdminDetailPageHeader } from "@/features/admin/components/layout/AdminDetailPageHeader";
import { ROUTES } from "@/lib/constants/routes";

import { AdminAiPromptFamilyForm } from "./AdminAiPromptFamilyForm";

type AdminAiPromptFamilyCreateClientProps = {
  /** 생성 화면에서 기본 선택할 Agent ID입니다. */
  initialAgentId?: string;
};

/**
 * 관리자 AI Prompt Family 생성 페이지를 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @returns 관리자 AI Prompt Family 생성 화면
 */
export function AdminAiPromptFamilyCreateClient({
  initialAgentId,
}: AdminAiPromptFamilyCreateClientProps) {
  return (
    <div className="space-y-6">
      <AdminBreadcrumbDynamicItems
        items={[
          {
            label: "새 프롬프트 패밀리 생성",
          },
        ]}
      />
      <AdminDetailPageHeader
        title="Prompt Family 추가"
        description="Agent에 적용할 Prompt Family와 초기 Prompt Version을 생성합니다."
        backHref={ROUTES.ADMIN.AI.PROMPTS}
        backLabel="Prompt 목록"
      />

      {initialAgentId ? (
        <AdminAiPromptFamilyForm initialAgentId={initialAgentId} />
      ) : (
        <AdminAiPromptFamilyForm />
      )}
    </div>
  );
}
