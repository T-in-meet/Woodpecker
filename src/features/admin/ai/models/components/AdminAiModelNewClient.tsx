import { AdminBreadcrumbDynamicItems } from "@/features/admin/components/layout/AdminBreadcrumbDynamicItems";
import { AdminDetailPageHeader } from "@/features/admin/components/layout/AdminDetailPageHeader";
import { ROUTES } from "@/lib/constants/routes";

import { AdminAiModelForm } from "./AdminAiModelForm";

/**
 * 관리자 AI 모델 생성 페이지를 렌더링합니다.
 *
 * @returns AI 모델 생성 페이지
 */
export function AdminAiModelNewClient() {
  return (
    <div className="space-y-6">
      <AdminBreadcrumbDynamicItems
        items={[
          {
            label: "모델 생성",
          },
        ]}
      />

      <AdminDetailPageHeader
        title="AI 모델 생성"
        description="AI 기능에서 사용할 모델 설정을 생성합니다."
        backHref={ROUTES.ADMIN.AI.MODELS}
        backLabel="모델 목록"
      />

      <AdminAiModelForm />
    </div>
  );
}
