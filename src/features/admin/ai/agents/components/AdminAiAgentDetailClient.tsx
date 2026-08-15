"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AdminCollapsibleSection } from "@/features/admin/components/common/AdminCollapsibleSection";
import { AdminListError } from "@/features/admin/components/common/AdminListState";
import { AdminBreadcrumbDynamicItems } from "@/features/admin/components/layout/AdminBreadcrumbDynamicItems";
import { AdminDetailPageHeader } from "@/features/admin/components/layout/AdminDetailPageHeader";
import { ROUTES } from "@/lib/constants/routes";

import { useAdminAiAgentDetail } from "../hooks/use-admin-ai-agent-queries";
import { AdminAiAgentDetailSkeleton } from "./AdminAiAgentDetailSkeleton";
import { AdminAiAgentForm } from "./AdminAiAgentForm";
import { AdminAiAgentPromptFamiliesTable } from "./AdminAiAgentPromptFamiliesTable";

type AdminAiAgentDetailClientProps = {
  /** 조회할 Agent ID입니다. */
  agentId: string;
};

/**
 * 관리자 AI Agent 상세 페이지를 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @returns 관리자 AI Agent 상세 화면
 */
export function AdminAiAgentDetailClient({
  agentId,
}: AdminAiAgentDetailClientProps) {
  const router = useRouter();
  const { data: agent, isError, isPending } = useAdminAiAgentDetail(agentId);

  return (
    <div className="space-y-6">
      <AdminBreadcrumbDynamicItems
        items={
          agent
            ? [
                {
                  label: agent.displayName || "상세",
                },
              ]
            : []
        }
        loading={isPending}
      />

      <AdminDetailPageHeader
        title="AI Agent 상세"
        description="AI 에이전트의 이름, 용도와 태그 정보를 확인하고 관리합니다."
        backHref={ROUTES.ADMIN.AI.AGENTS}
        backLabel="Agent 목록"
      />

      {isPending ? (
        <AdminAiAgentDetailSkeleton />
      ) : isError || !agent ? (
        <AdminListError
          description="AI Agent 상세 정보를 불러오지 못했습니다."
          action={
            <Button
              type="button"
              variant="outline"
              onClick={() => router.refresh()}
            >
              다시 시도
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <AdminCollapsibleSection title={`${agent.displayName} 상세 정보`}>
            <AdminAiAgentForm agent={agent} />
          </AdminCollapsibleSection>

          <AdminAiAgentPromptFamiliesTable families={agent.families} />
        </div>
      )}
    </div>
  );
}
