"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { AdminListToolbar } from "@/features/admin/components/common/AdminListToolbar";
import { AdminPagination } from "@/features/admin/components/common/AdminPagination";
import { AdminPageHeader } from "@/features/admin/components/layout/AdminPageHeader";
import { useAdminListToolbar } from "@/features/admin/hooks/use-admin-list-toolbar";
import { ROUTES } from "@/lib/constants/routes";

import { useAdminAiModels } from "../../models/hooks/use-admin-ai-model-queries";
import { createAdminAiSettingListConfig } from "../constants/ai-settings-list";
import { useAdminAiSettings } from "../hooks/use-admin-ai-setting-queries";
import { AdminAiSettingsTable } from "./AdminAiSettingsTable";

/**
 * @description 관리자 AI 설정 목록 화면을 렌더링합니다.
 * @returns 관리자 AI 설정 목록 화면을 반환합니다.
 */
export function AdminAiSettingsClient() {
  const [currentPage, setCurrentPage] = useState(1);

  const { data: chatModelsData } = useAdminAiModels({
    page: 1,
    pageSize: 100,
    search: {
      field: "displayName",
      query: "",
    },
    filters: {
      capability: {
        field: "capability",
        type: "multi-select",
        value: ["chat"],
      },
    },
    sort: {
      field: "displayName",
      direction: "asc",
    },
  });

  const { data: embeddingModelsData } = useAdminAiModels({
    page: 1,
    pageSize: 100,
    search: {
      field: "displayName",
      query: "",
    },
    filters: {
      capability: {
        field: "capability",
        type: "multi-select",
        value: ["embedding"],
      },
    },
    sort: {
      field: "displayName",
      direction: "asc",
    },
  });

  const listConfig = useMemo(
    () =>
      createAdminAiSettingListConfig({
        chatModelOptions:
          chatModelsData?.items.map((model) => ({
            value: model.id,
            label: model.displayName,
          })) ?? [],
        embeddingModelOptions:
          embeddingModelsData?.items.map((model) => ({
            value: model.id,
            label: model.displayName,
          })) ?? [],
      }),
    [chatModelsData, embeddingModelsData],
  );

  const toolbar = useAdminListToolbar({
    config: listConfig,
    onApply: () => setCurrentPage(1),
  });

  const { data, isPending, isError } = useAdminAiSettings({
    page: currentPage,
    pageSize: listConfig.pagination.pageSize,
    search: toolbar.search,
    filters: toolbar.filters,
    sort: toolbar.sort,
  });

  const settings = data?.items ?? [];
  const totalCount = data?.pagination.total ?? 0;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="AI 설정"
        description="AI를 사용하는 기능별 AI 설정을 조회하고 관리합니다."
        backHref={ROUTES.ADMIN.AI.DASHBOARD}
        backLabel="AI 관리"
        actions={
          <Button asChild>
            <Link href={ROUTES.ADMIN.AI.SETTINGS_NEW}>
              <Plus aria-hidden="true" />
              설정 추가
            </Link>
          </Button>
        }
      />

      <div className="space-y-4">
        <AdminListToolbar config={listConfig} toolbar={toolbar} />

        <AdminAiSettingsTable
          settings={settings}
          isPending={isPending}
          isError={isError}
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
