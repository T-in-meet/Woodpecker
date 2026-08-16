"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { AdminCollapsibleSection } from "@/features/admin/components/common/AdminCollapsibleSection";
import { AdminListError } from "@/features/admin/components/common/AdminListState";
import { AdminBreadcrumbDynamicItems } from "@/features/admin/components/layout/AdminBreadcrumbDynamicItems";
import { AdminDetailPageHeader } from "@/features/admin/components/layout/AdminDetailPageHeader";
import {
  getAdminAiPromptVersionNewRoute,
  ROUTES,
} from "@/lib/constants/routes";

import { useAdminAiPromptFamilyDetail } from "../hooks/use-admin-ai-prompt-queries";
import { AdminAiPromptFamilyDetailSkeleton } from "./AdminAiPromptFamilyDetailSkeleton";
import { AdminAiPromptFamilyForm } from "./AdminAiPromptFamilyForm";
import { AdminAiPromptVersionsSection } from "./AdminAiPromptVersionsSection";

type AdminAiPromptFamilyDetailProps = {
  /** 조회할 Prompt Family ID입니다. */
  familyId: string;
};

/**
 * 관리자 AI Prompt Family 상세 페이지를 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @returns 관리자 AI Prompt Family 상세 화면
 */
export function AdminAiPromptFamilyDetailClient({
  familyId,
}: AdminAiPromptFamilyDetailProps) {
  const {
    data: family,
    isError,
    isPending,
    refetch,
  } = useAdminAiPromptFamilyDetail(familyId);

  return (
    <div className="space-y-6">
      <AdminBreadcrumbDynamicItems
        items={
          family
            ? [
                {
                  label: family.displayName || "상세",
                },
              ]
            : []
        }
        loading={isPending}
      />

      <AdminDetailPageHeader
        title="AI Prompt 상세"
        description="Prompt Family는 Agent에 적용할 수 있는 프롬프트 스타일 묶음이며 Agent 연결은 생성 후 변경할 수 없습니다."
        backHref={ROUTES.ADMIN.AI.PROMPTS}
        backLabel="Prompt 목록"
        actions={
          family ? (
            <Button asChild variant="outline">
              <Link href={getAdminAiPromptVersionNewRoute(family.id)}>
                <Plus aria-hidden="true" />새 Version
              </Link>
            </Button>
          ) : null
        }
      />

      {isPending ? (
        <AdminAiPromptFamilyDetailSkeleton />
      ) : isError || !family ? (
        <AdminListError
          description="AI Prompt Family 상세 정보를 불러오지 못했습니다."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void refetch();
              }}
            >
              다시 시도
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <AdminCollapsibleSection title={`${family.displayName} 상세 정보`}>
            <AdminAiPromptFamilyForm family={family} />
          </AdminCollapsibleSection>

          <AdminAiPromptVersionsSection family={family} />
        </div>
      )}
    </div>
  );
}
