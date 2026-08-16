import { AdminBreadcrumbDynamicItems } from "@/features/admin/components/layout/AdminBreadcrumbDynamicItems";
import { AdminDetailPageHeader } from "@/features/admin/components/layout/AdminDetailPageHeader";
import { ROUTES } from "@/lib/constants/routes";

import { AdminAiSettingCreateForm } from "./AdminAiSettingCreateForm";

/**
 * @description 관리자 AI 설정 생성 화면을 렌더링합니다.
 * @returns 관리자 AI 설정 생성 화면을 반환합니다.
 */
export function AdminAiSettingsCreateClient() {
  return (
    <div className="space-y-6">
      <AdminBreadcrumbDynamicItems
        items={[
          {
            label: "새 설정 추가",
          },
        ]}
      />

      <AdminDetailPageHeader
        title="AI 설정 생성"
        description="AI 설정의 이름, 키, 설명을 입력하여 새로운 AI 설정을 생성합니다."
        backHref={ROUTES.ADMIN.AI.SETTINGS}
        backLabel="AI 설정 목록"
      />

      <div>
        <AdminAiSettingCreateForm />
      </div>
    </div>
  );
}
