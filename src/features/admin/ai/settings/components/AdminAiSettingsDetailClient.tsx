"use client";

import { Button } from "@/components/ui/button";
import {
  AdminDetailError,
  AdminDetailLoading,
  AdminDetailNotFound,
} from "@/features/admin/components/common/AdminDetailState";
import { AdminBreadcrumbDynamicItems } from "@/features/admin/components/layout/AdminBreadcrumbDynamicItems";
import { AdminDetailPageHeader } from "@/features/admin/components/layout/AdminDetailPageHeader";
import { ROUTES } from "@/lib/constants/routes";

import { useAdminAiSettingDetail } from "../hooks/use-admin-ai-setting-queries";
import { AdminAiSettingConfigurationForm } from "./AdminAiSettingConfigurationForm";
import { AdminAiSettingInfoSection } from "./AdminAiSettingInfoSection";

type AdminAiSettingsDetailClientProps = {
  /** 조회할 AI 설정 ID입니다. */
  settingId: string;
};

/**
 * @description 관리자 AI 설정 상세 화면을 렌더링합니다.
 * @param props 관리자 AI 설정 상세 화면의 속성입니다.
 * @returns 관리자 AI 설정 상세 화면을 반환합니다.
 */
export function AdminAiSettingsDetailClient({
  settingId,
}: AdminAiSettingsDetailClientProps) {
  const {
    data: setting,
    error,
    isPending,
    refetch,
  } = useAdminAiSettingDetail(settingId);

  if (isPending) {
    return (
      <div className="space-y-6">
        <AdminBreadcrumbDynamicItems items={[]} loading />

        <AdminDetailPageHeader
          title="AI 설정 상세"
          description="AI 설정 정보를 확인하고 Chat 및 Embedding 구성을 관리합니다."
          backHref={ROUTES.ADMIN.AI.SETTINGS}
          backLabel="AI 설정 목록"
        />

        <AdminDetailLoading title="AI 설정 정보를 불러오는 중입니다." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <AdminDetailPageHeader
          title="AI 설정 상세"
          description="AI 설정 정보를 확인하고 Chat 및 Embedding 구성을 관리합니다."
          backHref={ROUTES.ADMIN.AI.SETTINGS}
          backLabel="AI 설정 목록"
        />

        <AdminDetailError
          title="AI 설정을 불러오지 못했습니다."
          action={
            <Button type="button" variant="outline" onClick={() => refetch()}>
              다시 시도
            </Button>
          }
        />
      </div>
    );
  }

  if (!setting) {
    return (
      <div className="space-y-6">
        <AdminDetailPageHeader
          title="AI 설정 상세"
          description="AI 설정 정보를 확인하고 Chat 및 Embedding 구성을 관리합니다."
          backHref={ROUTES.ADMIN.AI.SETTINGS}
          backLabel="AI 설정 목록"
        />

        <AdminDetailNotFound
          title="AI 설정을 찾을 수 없습니다."
          description="삭제되었거나 존재하지 않는 AI 설정입니다."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminBreadcrumbDynamicItems
        items={[
          {
            label: setting.displayName || "상세",
          },
        ]}
      />

      <AdminDetailPageHeader
        title="AI 설정 상세"
        description="AI 설정 정보를 확인하고 Chat 및 Embedding 구성을 관리합니다."
        backHref={ROUTES.ADMIN.AI.SETTINGS}
        backLabel="AI 설정 목록"
      />

      <div className="space-y-6">
        <AdminAiSettingInfoSection setting={setting} />
        <AdminAiSettingConfigurationForm
          settingId={settingId}
          settingKey={setting.key}
        />
      </div>
    </div>
  );
}
