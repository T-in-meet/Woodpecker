"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AdminListError } from "@/features/admin/components/common/AdminListState";
import { AdminBreadcrumbDynamicItems } from "@/features/admin/components/layout/AdminBreadcrumbDynamicItems";
import { AdminDetailPageHeader } from "@/features/admin/components/layout/AdminDetailPageHeader";
import { getAdminAiPromptFamilyRoute } from "@/lib/constants/routes";

import { AdminActionMessage } from "../../components/AdminActionMessage";
import { useAdminAiPromptVersionDetail } from "../hooks/use-admin-ai-prompt-queries";
import { useAdminAiPromptVersionLifecycleActions } from "../hooks/use-admin-ai-prompt-version-lifecycle-actions";
import { AdminAiPromptVersionDetailSkeleton } from "./AdminAiPromptVersionDetailSkeleton";
import { AdminAiPromptVersionForm } from "./AdminAiPromptVersionForm";
import { AdminAiPromptVersionLifecycleSelect } from "./AdminAiPromptVersionLifecycleSelect";

type AdminAiPromptVersionDetailClientProps = {
  /** Prompt Version이 속한 Family ID입니다. */
  familyId: string;

  /** 조회할 Prompt Version ID입니다. */
  versionId: string;
};

/**
 * 관리자 AI Prompt Version 상세 페이지를 렌더링합니다.
 *
 * Version 상세 조회와 수정 Form을 표시하고,
 * lifecycle 상태에 따라 Publish, Archive, Republish, Delete 작업을 제공합니다.
 *
 * @param props 컴포넌트 속성
 * @returns 관리자 AI Prompt Version 상세 화면
 */
export function AdminAiPromptVersionDetailClient({
  familyId,
  versionId,
}: AdminAiPromptVersionDetailClientProps) {
  const router = useRouter();

  const {
    data: detail,
    isError,
    isPending,
    refetch,
  } = useAdminAiPromptVersionDetail(familyId, versionId);

  const {
    deletePending,
    handleArchiveVersion,
    handleDeleteVersion,
    handlePublishVersion,
    message,
    pending,
  } = useAdminAiPromptVersionLifecycleActions({
    familyId,
    onDeleteSuccess: () => router.push(getAdminAiPromptFamilyRoute(familyId)),
  });

  return (
    <div className="space-y-6">
      <AdminBreadcrumbDynamicItems
        items={
          detail
            ? [
                {
                  href: getAdminAiPromptFamilyRoute(detail.family.id),
                  label: detail.family.displayName || "Family",
                },
                {
                  label: `v${detail.version.versionNumber} - ${detail.version.displayName}`,
                },
              ]
            : []
        }
        loading={isPending}
      />

      <AdminDetailPageHeader
        title="Prompt Version 상세"
        description={
          detail
            ? `${detail.family.agentDisplayName} / ${detail.family.displayName} Prompt Template을 관리합니다.`
            : "Prompt Version의 Template과 JSON 설정을 관리합니다."
        }
        backHref={getAdminAiPromptFamilyRoute(familyId)}
        backLabel="Family 상세"
      />

      {isPending ? (
        <AdminAiPromptVersionDetailSkeleton />
      ) : isError || !detail ? (
        <AdminListError
          description="Prompt Version 상세 정보를 불러오지 못했습니다."
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
        <div className="space-y-5">
          <div className="flex">
            <AdminAiPromptVersionLifecycleSelect
              version={detail.version}
              onPublish={handlePublishVersion}
              onArchive={handleArchiveVersion}
              pending={pending}
            />
          </div>

          <AdminActionMessage message={message} />

          <AdminAiPromptVersionForm
            family={detail.family}
            version={detail.version}
            onDelete={handleDeleteVersion}
            deletePending={deletePending}
          />
        </div>
      )}
    </div>
  );
}
