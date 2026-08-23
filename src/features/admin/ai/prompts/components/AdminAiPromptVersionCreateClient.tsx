"use client";

import type { ComponentProps } from "react";

import { AdminBreadcrumbDynamicItems } from "@/features/admin/components/layout/AdminBreadcrumbDynamicItems";
import { AdminDetailPageHeader } from "@/features/admin/components/layout/AdminDetailPageHeader";
import { getAdminAiPromptFamilyRoute } from "@/lib/constants/routes";

import { AdminAiPromptVersionForm } from "./AdminAiPromptVersionForm";

type AdminAiPromptVersionCreateClientProps = {
  /** Prompt Version을 생성할 Family 정보입니다. */
  family: ComponentProps<typeof AdminAiPromptVersionForm>["family"];
};

/**
 * 관리자 AI Prompt Version 생성 페이지를 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @returns 관리자 AI Prompt Version 생성 화면
 */
export function AdminAiPromptVersionCreateClient({
  family,
}: AdminAiPromptVersionCreateClientProps) {
  return (
    <div className="space-y-6">
      <AdminBreadcrumbDynamicItems
        items={[
          {
            href: getAdminAiPromptFamilyRoute(family.id),
            label: family.displayName || "Family",
          },
          {
            label: "새 Prompt Version 생성",
          },
        ]}
      />

      <AdminDetailPageHeader
        title="Prompt Version 추가"
        description="새로운 Prompt Version을 생성합니다."
        backHref={getAdminAiPromptFamilyRoute(family.id)}
        backLabel="Family 상세"
      />

      <AdminAiPromptVersionForm family={family} />
    </div>
  );
}
