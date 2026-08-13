"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ADMIN_UNKNOWN_ERROR_MESSAGE } from "@/features/admin/ai/constants/errors";
import { AdminListError } from "@/features/admin/components/common/AdminListState";
import { AdminBreadcrumbDynamicItems } from "@/features/admin/components/layout/AdminBreadcrumbDynamicItems";
import { AdminDetailPageHeader } from "@/features/admin/components/layout/AdminDetailPageHeader";
import { getAdminAiPromptFamilyRoute } from "@/lib/constants/routes";

import { AdminActionMessage } from "../../components/AdminActionMessage";
import { useAdminAiPromptVersionDetail } from "../hooks/use-admin-ai-prompt-queries";
import {
  useArchiveAdminAiPromptVersion,
  useDeleteAdminAiPromptVersion,
  usePublishAdminAiPromptVersion,
} from "../hooks/use-admin-ai-prompt-version-mutations";
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
  } = useAdminAiPromptVersionDetail(familyId, versionId);

  const publishMutation = usePublishAdminAiPromptVersion();
  const archiveMutation = useArchiveAdminAiPromptVersion();
  const deleteMutation = useDeleteAdminAiPromptVersion();

  const [message, setMessage] = useState<string | null>(null);

  /**
   * Prompt Version lifecycle 작업 결과를 처리합니다.
   *
   * @param result lifecycle Mutation 결과
   * @param successMessage 성공 시 표시할 메시지
   */
  function handleVersionActionResult(
    result: {
      message?: string;
      ok: boolean;
    },
    successMessage: string,
  ) {
    if (!result.ok) {
      setMessage(result.message ?? "처리하지 못했습니다.");
      return;
    }

    setMessage(null);
    toast.success(successMessage);
    router.refresh();
  }

  /**
   * 예상하지 못한 lifecycle 작업 오류를 처리합니다.
   */
  function handleVersionActionError() {
    toast.error(ADMIN_UNKNOWN_ERROR_MESSAGE);
  }

  /**
   * Draft 또는 Archived Prompt Version을 Publish합니다.
   *
   * @param targetVersionId 대상 Prompt Version ID
   */
  function handlePublishVersion(targetVersionId: string) {
    setMessage(null);

    void publishMutation
      .mutateAsync(targetVersionId)
      .then((result) =>
        handleVersionActionResult(
          result,
          "AI Prompt Version을 Publish했습니다.",
        ),
      )
      .catch(handleVersionActionError);
  }

  /**
   * Published Prompt Version을 Archive합니다.
   *
   * @param targetVersionId 대상 Prompt Version ID
   */
  function handleArchiveVersion(targetVersionId: string) {
    setMessage(null);

    void archiveMutation
      .mutateAsync(targetVersionId)
      .then((result) =>
        handleVersionActionResult(
          result,
          "AI Prompt Version을 Archive했습니다.",
        ),
      )
      .catch(handleVersionActionError);
  }

  /**
   * 삭제 가능한 Prompt Version을 삭제합니다.
   *
   * Draft와 Archived Version을 삭제할 수 있으며,
   * 삭제 후 현재 Version 상세 페이지는 유효하지 않으므로
   * Prompt Family 상세 페이지로 이동합니다.
   *
   * @param targetVersionId 대상 Prompt Version ID
   */
  function handleDeleteVersion(targetVersionId: string) {
    setMessage(null);

    void deleteMutation
      .mutateAsync({
        familyId,
        versionId: targetVersionId,
      })
      .then((result) => {
        if (!result.ok) {
          setMessage(result.message ?? "처리하지 못했습니다.");
          return;
        }

        setMessage(null);
        toast.success("AI Prompt Version을 삭제했습니다.");
        router.push(getAdminAiPromptFamilyRoute(familyId));
      })
      .catch(handleVersionActionError);
  }

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
              onClick={() => router.refresh()}
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
              pending={publishMutation.isPending || archiveMutation.isPending}
            />
          </div>

          <AdminActionMessage message={message} />

          <AdminAiPromptVersionForm
            family={detail.family}
            version={detail.version}
            onDelete={handleDeleteVersion}
            deletePending={deleteMutation.isPending}
          />
        </div>
      )}
    </div>
  );
}
