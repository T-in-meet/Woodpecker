import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils/cn";

import {
  FEEDBACK_CATEGORY_LABELS,
  FEEDBACK_STATUS_LABELS,
} from "../constants/feedback-labels";
import type { AdminFeedbackDetail } from "../types/feedback-detail";
import { AdminFeedbackImageGallery } from "./AdminFeedbackImageGallery";

interface AdminFeedbackSourcePanelProps {
  /** 사용자 피드백 원문과 작성자 정보를 포함한 상세 데이터 */
  feedback: AdminFeedbackDetail;

  className?: string;
}

/**
 * 관리자 상세 페이지에서 사용자가 제출한 피드백 원문을 표시합니다.
 *
 * 답변 작성 중에도 관리자가 맥락을 잃지 않도록 작성자, 상태, 연결 노트,
 * 본문, 첨부 이미지를 한 패널 안에서 확인할 수 있게 구성합니다.
 */
export function AdminFeedbackSourcePanel({
  feedback,
  className,
}: AdminFeedbackSourcePanelProps) {
  return (
    <section className={cn("min-w-0 space-y-4", className)}>
      <Card className="rounded-md">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <CardTitle className="leading-6">{feedback.title}</CardTitle>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatDateTime(feedback.createdAt)}
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <Badge
                variant={feedback.status === "OPEN" ? "default" : "secondary"}
              >
                {FEEDBACK_STATUS_LABELS[feedback.status]}
              </Badge>
              <Badge variant="outline">
                {FEEDBACK_CATEGORY_LABELS[feedback.category]}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="space-y-6 pt-6">
          <div className="flex items-center gap-3">
            <UserAvatar
              avatarUrl={feedback.user.avatarUrl}
              name={feedback.user.name}
            />
            <div className="min-w-0">
              <div className="font-medium">{feedback.user.name}</div>
              <div className="truncate text-sm text-muted-foreground">
                {feedback.user.email ?? feedback.user.id}
              </div>
            </div>
          </div>

          {feedback.note ? (
            <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">
              <div className="text-muted-foreground">연결 노트</div>
              <div className="mt-1 font-medium">{feedback.note.title}</div>
            </div>
          ) : null}

          <div className="whitespace-pre-wrap rounded-md bg-muted/30 p-4 text-sm leading-6">
            {feedback.content}
          </div>

          {feedback.images.length > 0 ? (
            <AdminFeedbackImageGallery images={feedback.images} />
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}

/**
 * 사용자 avatar_url이 있으면 이미지를, 없으면 이름 첫 글자 fallback을 표시합니다.
 */
function UserAvatar({
  avatarUrl,
  name,
}: {
  avatarUrl: string | null;
  name: string;
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={44}
        height={44}
        className="size-11 rounded-full object-cover"
      />
    );
  }

  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
      {name.charAt(0)}
    </div>
  );
}

/**
 * 피드백 작성 시각을 관리자 화면 표기 형식으로 변환합니다.
 */
function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
