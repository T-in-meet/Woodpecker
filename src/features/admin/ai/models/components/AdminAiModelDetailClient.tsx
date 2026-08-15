"use client";

import { Button } from "@/components/ui/button";
import { AdminListError } from "@/features/admin/components/common/AdminListState";
import { AdminBreadcrumbDynamicItems } from "@/features/admin/components/layout/AdminBreadcrumbDynamicItems";
import { AdminDetailPageHeader } from "@/features/admin/components/layout/AdminDetailPageHeader";
import { ROUTES } from "@/lib/constants/routes";

import { useAdminAiModelDetail } from "../hooks/use-admin-ai-model-queries";
import { AdminAiModelDetailSkeleton } from "./AdminAiModelDetailSkeleton";
import { AdminAiModelForm } from "./AdminAiModelForm";

type AdminAiModelDetailProps = {
  /** 조회할 모델 설정 ID입니다. */
  modelConfigId: string;
};

/**
 * 관리자 AI 모델 상세 페이지를 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @returns 관리자 AI 모델 상세 화면
 */
export function AdminAiModelDetailClient({
  modelConfigId,
}: AdminAiModelDetailProps) {
  const {
    data: model,
    isError,
    isPending,
    refetch,
  } = useAdminAiModelDetail(modelConfigId);

  return (
    <div className="space-y-6">
      <AdminBreadcrumbDynamicItems
        items={
          model
            ? [
                {
                  label: model.displayName || "상세",
                },
              ]
            : []
        }
        loading={isPending}
      />

      <AdminDetailPageHeader
        title="AI 모델 상세"
        description="모델 key는 기능 코드의 내부 식별자이므로 생성 후 변경할 수 없습니다."
        backHref={ROUTES.ADMIN.AI.MODELS}
        backLabel="모델 목록"
      />

      {isPending ? (
        <AdminAiModelDetailSkeleton />
      ) : isError || !model ? (
        <AdminListError
          description="AI 모델 상세 정보를 불러오지 못했습니다."
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
        <AdminAiModelForm model={model} />
      )}
    </div>
  );
}
