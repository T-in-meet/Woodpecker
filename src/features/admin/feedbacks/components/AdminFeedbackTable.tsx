import { Badge } from "@/components/ui/badge";
import {
  AdminListEmpty,
  AdminListError,
} from "@/features/admin/components/common/AdminListState";
import { cn } from "@/lib/utils/cn";

import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUS_LABELS,
} from "../constants/feedback-labels";
import type { AdminFeedbackListItem } from "../types/feedback-list";
import { AdminFeedbackTableSkeleton } from "./AdminFeedbackTableSkeleton";

interface AdminFeedbackTableProps {
  feedbacks: AdminFeedbackListItem[];
  isPending: boolean;
  isError: boolean;
}

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
                    <div className="font-medium">{feedback.title}</div>
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
