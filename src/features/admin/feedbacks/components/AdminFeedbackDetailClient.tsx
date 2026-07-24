"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AdminListError } from "@/features/admin/components/common/AdminListState";
import { AdminPageHeader } from "@/features/admin/components/layout/AdminPageHeader";
import { ROUTES } from "@/lib/constants/routes";

import { AdminBreadcrumbDynamicItems } from "../../components/layout/AdminBreadcrumbDynamicItems";
import { useFeedbackDetail } from "../hooks/use-feedback-detail";
import { AdminFeedbackDetailSkeleton } from "./AdminFeedbackDetailSkeleton";
import { AdminFeedbackReplyPanel } from "./AdminFeedbackReplyPanel";
import { AdminFeedbackSourcePanel } from "./AdminFeedbackSourcePanel";

/**
 * 관리자 피드백 상세 페이지의 클라이언트 컨테이너입니다.
 *
 * 라우트 파라미터의 feedbackId로 상세 데이터를 조회하고, 화면 폭에 따라
 * 사용자 피드백 원문과 관리자 답변 패널을 좌우 또는 상하로 배치합니다.
 */
export function AdminFeedbackDetailClient() {
  const params = useParams<{ feedbackId: string }>();
  const router = useRouter();
  const feedbackId = params.feedbackId;
  const { data, isPending, isError } = useFeedbackDetail(feedbackId);

  return (
    <div className="space-y-6">
      <AdminBreadcrumbDynamicItems
        items={
          data
            ? [
                {
                  label: data.title || "상세",
                },
              ]
            : []
        }
        loading={isPending}
      />
      <AdminPageHeader
        title="피드백 상세"
        description="사용자 피드백 내용을 확인하고 관리자 답변을 작성합니다."
      />

      <div>
        <Button asChild type="button" variant="outline" size="sm">
          <Link href={ROUTES.ADMIN.FEEDBACKS}>
            <ArrowLeft aria-hidden="true" />
            목록
          </Link>
        </Button>
      </div>

      {isPending ? (
        <AdminFeedbackDetailSkeleton />
      ) : isError || !data ? (
        <AdminListError
          description="피드백 상세 정보를 불러오지 못했습니다."
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
        // 데스크톱에서는 답변 작성 중 원문을 계속 볼 수 있도록 2열 레이아웃을 사용한다.
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,480px)]">
          <AdminFeedbackSourcePanel feedback={data} />
          <AdminFeedbackReplyPanel feedback={data} />
        </div>
      )}
    </div>
  );
}
