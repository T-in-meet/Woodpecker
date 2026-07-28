"use client";

import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { AdminListError } from "@/features/admin/components/common/AdminListState";
import { ROUTES } from "@/lib/constants/routes";

import { AdminBreadcrumbDynamicItems } from "../../components/layout/AdminBreadcrumbDynamicItems";
import { AdminDetailPageHeader } from "../../components/layout/AdminDetailPageHeader";
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

      <AdminDetailPageHeader
        title="피드백 상세"
        description="사용자 피드백 내용을 확인하고 관리자 답변을 작성합니다."
        backHref={ROUTES.ADMIN.FEEDBACKS}
        backLabel="피드백 목록"
      />

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
        // AdminDetailPageHeader가 스크롤에 의해 완전히 사라지고 나면,
        // 이 컨테이너가 상단(main 기준 top:0)에 고정되면서 더 이상 페이지 스크롤이
        // 발생하지 않는다. 이 시점부터는 각 패널 내부 overflow-y-auto가 스크롤을 담당한다.

        <div className="min-w-0 lg:sticky lg:top-6 lg:h-[calc(100vh-var(--header-height)-3rem-28px)]">
          <div className="grid min-w-0 gap-6 lg:h-full lg:grid-cols-2">
            <AdminFeedbackSourcePanel
              className="lg:h-full lg:min-h-0 lg:overflow-y-auto"
              feedback={data}
            />
            <AdminFeedbackReplyPanel
              className="lg:h-full lg:min-h-0 lg:overflow-y-auto"
              feedback={data}
            />
          </div>
        </div>
      )}
    </div>
  );
}
