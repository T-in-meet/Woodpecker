"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/features/admin/components/common/AdminListToolbar";
import { AdminPagination } from "@/features/admin/components/common/AdminPagination";
import { AdminPageHeader } from "@/features/admin/components/layout/AdminPageHeader";
import { useAdminListToolbar } from "@/features/admin/hooks/use-admin-list-toolbar";
import type { AdminListConfig } from "@/features/admin/types/list";
import { ROUTES } from "@/lib/constants/routes";

import { useAdminAiAgentOptions } from "../../agents/hooks/use-admin-ai-agent-queries";
import { ADMIN_AI_PROMPT_LIST_CONFIG } from "../constants/ai-prompt-list";
import { useAdminAiPromptFamilies } from "../hooks/use-admin-ai-prompt-queries";
import type {
  AdminAiPromptFilterField,
  AdminAiPromptSearchField,
  AdminAiPromptSortField,
} from "../types";
import { AdminAiPromptsTable } from "./AdminAiPromptsTable";

/**
 * 관리자 AI Prompt 목록 페이지의 클라이언트 컨테이너입니다.
 *
 * 공통 관리자 toolbar 상태를 TanStack Query의 목록 조회 조건으로 연결하고,
 * 검색/필터 적용 시 현재 페이지를 첫 페이지로 되돌립니다.
 */
export function AdminAiPromptsClient() {
  const [currentPage, setCurrentPage] = useState(1);
  const agentOptionsQuery = useAdminAiAgentOptions();
  const listConfig = useMemo<
    AdminListConfig<
      AdminAiPromptSearchField,
      AdminAiPromptFilterField,
      AdminAiPromptSortField
    >
  >(() => {
    return {
      ...ADMIN_AI_PROMPT_LIST_CONFIG,
      filters: ADMIN_AI_PROMPT_LIST_CONFIG.filters.map((filter) => {
        if (filter.field !== "agentId" || filter.type !== "multi-select") {
          return filter;
        }

        return {
          ...filter,
          options: (agentOptionsQuery.data ?? []).map((agent) => ({
            label: agent.displayName,
            value: agent.id,
          })),
        };
      }),
    };
  }, [agentOptionsQuery.data]);

  const toolbar = useAdminListToolbar({
    config: listConfig,
    onApply: () => setCurrentPage(1),
  });

  const { data, isError, isPending } = useAdminAiPromptFamilies({
    page: currentPage,
    pageSize: listConfig.pagination.pageSize,
    search: toolbar.search,
    filters: toolbar.filters,
    sort: toolbar.sort,
  });

  const families = data?.items ?? [];
  const totalCount = data?.pagination.total ?? 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="AI 프롬프트"
        description="Agent에 적용할 prompt family와 version 이력을 관리합니다."
        backHref={ROUTES.ADMIN.AI.DASHBOARD}
        backLabel="AI 관리"
        actions={
          <Button asChild>
            <Link href={ROUTES.ADMIN.AI.PROMPTS_NEW}>
              <Plus aria-hidden="true" />
              Prompt 추가
            </Link>
          </Button>
        }
      />

      <div className="space-y-4">
        <AdminListToolbar config={listConfig} toolbar={toolbar} />

        <AdminAiPromptsTable
          families={families}
          isError={isError}
          isPending={isPending}
          sort={toolbar.sort}
          onSortChange={toolbar.handleSortChange}
        />

        <AdminPagination
          currentPage={currentPage}
          totalCount={totalCount}
          config={listConfig.pagination}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
