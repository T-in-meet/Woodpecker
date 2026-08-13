"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/features/admin/components/common/AdminListToolbar";
import { AdminPagination } from "@/features/admin/components/common/AdminPagination";
import { AdminPageHeader } from "@/features/admin/components/layout/AdminPageHeader";
import { useAdminListToolbar } from "@/features/admin/hooks/use-admin-list-toolbar";
import { ROUTES } from "@/lib/constants/routes";

import { ADMIN_AI_AGENT_LIST_CONFIG } from "../constants/ai-agent-list";
import { useAdminAiAgents } from "../hooks/use-admin-ai-agent-queries";
import { AdminAiAgentsTable } from "./AdminAiAgentsTable";

/**
 * 관리자 AI Agent 목록 페이지의 클라이언트 컨테이너입니다.
 *
 * 공통 관리자 toolbar 상태를 TanStack Query의 목록 조회 조건으로 연결하고,
 * 검색/필터 적용 시 현재 페이지를 첫 페이지로 되돌립니다.
 */
export function AdminAiAgentsClient() {
  const [currentPage, setCurrentPage] = useState(1);

  const toolbar = useAdminListToolbar({
    config: ADMIN_AI_AGENT_LIST_CONFIG,
    onApply: () => setCurrentPage(1),
  });

  const { data, isError, isPending } = useAdminAiAgents({
    page: currentPage,
    pageSize: ADMIN_AI_AGENT_LIST_CONFIG.pagination.pageSize,
    search: toolbar.search,
    filters: toolbar.filters,
    sort: toolbar.sort,
  });

  const agents = data?.items ?? [];
  const totalCount = data?.pagination.total ?? 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="AI 에이전트"
        description="기능 코드가 참조하는 AI 실행 슬롯과 active prompt를 관리합니다."
        backHref={ROUTES.ADMIN.AI.DASHBOARD}
        backLabel="AI 관리"
        actions={
          <Button asChild>
            <Link href={ROUTES.ADMIN.AI.AGENTS_NEW}>
              <Plus aria-hidden="true" />
              Agent 추가
            </Link>
          </Button>
        }
      />

      <div className="space-y-4">
        <AdminListToolbar
          config={ADMIN_AI_AGENT_LIST_CONFIG}
          toolbar={toolbar}
        />

        <AdminAiAgentsTable
          agents={agents}
          isError={isError}
          isPending={isPending}
          sort={toolbar.sort}
          onSortChange={toolbar.handleSortChange}
        />

        <AdminPagination
          currentPage={currentPage}
          totalCount={totalCount}
          config={ADMIN_AI_AGENT_LIST_CONFIG.pagination}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
