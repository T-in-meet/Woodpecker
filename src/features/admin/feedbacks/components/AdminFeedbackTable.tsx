import Link from "next/link";

import { TableHead } from "@/components/ui/table";
import {
  AdminListEmpty,
  AdminListError,
} from "@/features/admin/components/common/AdminListState";
import { getAdminFeedbackDetailRoute } from "@/lib/constants/routes";

import { AdminBadge } from "../../components/common/AdminBadge";
import { AdminSortableTableHead } from "../../components/common/AdminSortableTableHead";
import type { AdminSort } from "../../types/sort";
import {
  FEEDBACK_CATEGORY_BADGE_CONFIG,
  FEEDBACK_STATUS_BADGE_CONFIG,
} from "../constants/feedback-list";
import type {
  AdminFeedbackListItem,
  FeedbackSortField,
} from "../types/feedback-list";
import { AdminFeedbackTableSkeleton } from "./AdminFeedbackTableSkeleton";

interface AdminFeedbackTableProps {
  /** 현재 페이지에 표시할 피드백 목록 */
  feedbacks: AdminFeedbackListItem[];

  /** 최초 목록 조회 진행 여부 */
  isPending: boolean;

  /** 목록 조회 실패 여부 */
  isError: boolean;

  /** 현재 적용된 정렬 조건 */
  sort: AdminSort<FeedbackSortField>;

  /** 정렬 조건 변경 이벤트 */
  onSortChange: (sort: AdminSort<FeedbackSortField>) => void;
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
  sort,
  onSortChange,
}: AdminFeedbackTableProps) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-270 text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <AdminSortableTableHead
                field="status"
                sort={sort}
                onSortChange={onSortChange}
              >
                상태
              </AdminSortableTableHead>

              <AdminSortableTableHead
                field="category"
                sort={sort}
                onSortChange={onSortChange}
              >
                카테고리
              </AdminSortableTableHead>

              <AdminSortableTableHead
                field="title"
                sort={sort}
                onSortChange={onSortChange}
              >
                피드백
              </AdminSortableTableHead>

              <TableHead>사용자</TableHead>

              <TableHead>첨부</TableHead>

              <TableHead>답변 작성자</TableHead>

              <TableHead>연결 노트</TableHead>

              <AdminSortableTableHead
                field="createdAt"
                sort={sort}
                onSortChange={onSortChange}
              >
                등록일
              </AdminSortableTableHead>
            </tr>
          </thead>

          <tbody>
            {isPending ? (
              <AdminFeedbackTableSkeleton />
            ) : isError ? (
              <tr>
                <td colSpan={8}>
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
                    <FeedbackCategoryBadge category={feedback.category} />
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

                  <td className="max-w-44 px-4 py-3 align-top">
                    {feedback.replyAuthorLabel ? (
                      <div className="min-w-0">
                        <div className="font-medium">
                          {feedback.replyAuthorLabel}
                        </div>
                        <div
                          className="truncate text-xs text-muted-foreground"
                          title={feedback.replyAuthorId ?? undefined}
                        >
                          {feedback.replyAuthorId}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
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
                <td colSpan={8}>
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
 * 피드백 처리 상태를 목록에서 빠르게 확인할 수 있는 배지로 표시합니다.
 */
function FeedbackStatusBadge({
  status,
}: {
  status: AdminFeedbackListItem["status"];
}) {
  const badge = FEEDBACK_STATUS_BADGE_CONFIG[status];

  return <AdminBadge color={badge.color}>{badge.label}</AdminBadge>;
}

/**
 * 피드백 카테고리를 목록에서 빠르게 확인할 수 있는 배지로 표시합니다.
 */
function FeedbackCategoryBadge({
  category,
}: {
  category: AdminFeedbackListItem["category"];
}) {
  const badge = FEEDBACK_CATEGORY_BADGE_CONFIG[category];

  return <AdminBadge color={badge.color}>{badge.label}</AdminBadge>;
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
