import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  AdminListEmpty,
  AdminListError,
} from "@/features/admin/components/common/AdminListState";
import { getAdminFeedbackDetailRoute } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUS_LABELS,
} from "../constants/feedback-labels";
import type { AdminFeedbackListItem } from "../types/feedback-list";
import { AdminFeedbackTableSkeleton } from "./AdminFeedbackTableSkeleton";

interface AdminFeedbackTableProps {
  /** 현재 페이지에 표시할 피드백 목록 */
  feedbacks: AdminFeedbackListItem[];

  /** 최초 목록 조회 진행 여부 */
  isPending: boolean;

  /** 목록 조회 실패 여부 */
  isError: boolean;
}

/**
 * 관리자 피드백 목록을 테이블 형태로 표시합니다.
 *
 * 각 행의 제목은 상세 페이지 진입점이며, 로딩/오류/빈 결과 상태를
 * 테이블 영역 안에서 동일한 높이와 구조로 처리합니다.
 */
export function AdminFeedbackTable({
  feedbacks,
  isPending,
  isError,
}: AdminFeedbackTableProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-245 text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">상태</th>
              <th className="px-4 py-3 text-left font-medium">카테고리</th>
              <th className="px-4 py-3 text-left font-medium">피드백</th>
              <th className="px-4 py-3 text-left font-medium">사용자</th>
              <th className="px-4 py-3 text-left font-medium">첨부</th>
              <th className="px-4 py-3 text-left font-medium">연결 노트</th>
              <th className="px-4 py-3 text-left font-medium">등록일</th>
            </tr>
          </thead>

          <tbody>
            {isPending ? (
              <AdminFeedbackTableSkeleton />
            ) : isError ? (
              <tr>
                <td colSpan={7}>
                  <AdminListError description="피드백 목록을 불러오지 못했습니다." />
                </td>
              </tr>
            ) : feedbacks.length > 0 ? (
              feedbacks.map((feedback) => (
                <tr key={feedback.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 align-top">
                    <FeedbackStatusBadge status={feedback.status} />
                  </td>

                  <td className="px-4 py-3 align-top">
                    {FEEDBACK_CATEGORY_LABELS[feedback.category]}
                  </td>

                  <td className="max-w-md px-4 py-3 align-top">
                    <Link
                      href={getAdminFeedbackDetailRoute(feedback.id)}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {feedback.title}
                    </Link>
                    <p className="mt-1 line-clamp-2 text-muted-foreground">
                      {feedback.contentPreview}
                    </p>
                  </td>

                  <td className="px-4 py-3 align-top">
                    <div className="font-medium">{feedback.userLabel}</div>
                    <div className="text-xs text-muted-foreground">
                      {feedback.userEmail ?? feedback.userId}
                    </div>
                  </td>

                  <td className="px-4 py-3 align-top">
                    {feedback.imageCount > 0 ? `${feedback.imageCount}개` : "-"}
                  </td>

                  <td className="max-w-48 px-4 py-3 align-top">
                    {feedback.noteTitle ? (
                      <div className="truncate" title={feedback.noteTitle}>
                        {feedback.noteTitle}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>

                  <td className="px-4 py-3 align-top">
                    {formatDateTime(feedback.createdAt)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <AdminListEmpty description="검색 조건과 일치하는 피드백이 없습니다." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * 피드백 처리 상태를 목록에서 빠르게 스캔할 수 있는 badge로 표시합니다.
 */
function FeedbackStatusBadge({
  status,
}: {
  status: AdminFeedbackListItem["status"];
}) {
  return (
    <Badge
      variant={status === "OPEN" ? "default" : "secondary"}
      className={cn(status === "RESOLVED" && "text-muted-foreground")}
    >
      {FEEDBACK_STATUS_LABELS[status]}
    </Badge>
  );
}

/**
 * 목록 등록일을 관리자 화면 표기 형식으로 변환합니다.
 */
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
