"use client";

import { ChevronDown, StickyNote } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Card } from "@/components/ui/card";
import { ROUTES } from "@/lib/constants/routes";
import { cn } from "@/lib/utils/cn";

import type { FeedbackImage, MyFeedback } from "../queries";
import { FEEDBACK_CATEGORY_LABELS, type FeedbackCategory } from "../schema";
import { DeleteFeedbackDialog } from "./DeleteFeedbackDialog";

type FeedbackListProps = {
  feedbacks: MyFeedback[];
};

function categoryLabel(category: string): string {
  return FEEDBACK_CATEGORY_LABELS[category as FeedbackCategory] ?? category;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ko-KR");
}

function FeedbackImages({ images }: { images: FeedbackImage[] }) {
  const visible = images.filter(
    (image): image is FeedbackImage & { url: string } => image.url !== null,
  );
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((image) => (
        <a
          key={image.path}
          href={image.url}
          target="_blank"
          rel="noopener noreferrer"
          className="cursor-pointer"
        >
          {/* 서명 URL은 remotePatterns 미등록 + 요청마다 달라져 최적화 캐시가 무의미 → unoptimized */}
          <Image
            src={image.url}
            alt="첨부 이미지"
            width={96}
            height={96}
            unoptimized
            className="size-24 rounded-md border object-cover transition-opacity hover:opacity-80"
          />
        </a>
      ))}
    </div>
  );
}

export function FeedbackList({ feedbacks }: FeedbackListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (feedbacks.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        아직 제출한 문의사항이 없습니다.
      </p>
    );
  }

  return (
    <ul className="list-none space-y-3">
      {feedbacks.map((feedback) => {
        const isExpanded = expandedId === feedback.id;

        return (
          <li key={feedback.id}>
            <Card className="overflow-hidden py-0">
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setExpandedId(isExpanded ? null : feedback.id)}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
              >
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {categoryLabel(feedback.category)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {feedback.title}
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {formatDate(feedback.created_at)}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-xs",
                    feedback.reply
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {feedback.reply ? "답변 완료" : "답변 대기"}
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isExpanded && "rotate-180",
                  )}
                />
              </button>

              {isExpanded && (
                <div className="space-y-4 border-t px-4 py-4">
                  <p className="text-sm whitespace-pre-wrap wrap-break-word">
                    {feedback.content}
                  </p>

                  <FeedbackImages images={feedback.images} />

                  {feedback.note && (
                    <Link
                      href={`${ROUTES.NOTES}/${feedback.note.id}`}
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <StickyNote className="size-3.5" />
                      연결된 노트: {feedback.note.title}
                    </Link>
                  )}

                  {feedback.reply ? (
                    <div className="space-y-2 rounded-md bg-muted/60 px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">
                          {feedback.reply.title}
                        </p>
                        <p className="shrink-0 text-xs text-muted-foreground">
                          {formatDate(feedback.reply.created_at)}
                        </p>
                      </div>
                      <p className="text-sm whitespace-pre-wrap wrap-break-word text-muted-foreground">
                        {feedback.reply.content}
                      </p>
                      <FeedbackImages images={feedback.reply.images} />
                    </div>
                  ) : (
                    <div className="flex justify-end">
                      <DeleteFeedbackDialog
                        feedbackId={feedback.id}
                        feedbackTitle={feedback.title}
                      />
                    </div>
                  )}
                </div>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
