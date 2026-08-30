"use client";

import { useRelatedNotes } from "../hooks/use-related-notes";
import { AddRelatedNoteDialog } from "./AddRelatedNoteDialog";
import { RelatedNoteItem } from "./RelatedNoteItem";

type RelatedNotesSectionProps = {
  /** Related Notes를 조회할 기준 Note ID입니다. */
  noteId: string;
};

/**
 * 노트 상세 하단에 현재 연결된 Related Notes를 표시합니다.
 *
 * Related Notes는 노트 본문과 독립적으로 조회하며,
 * active 상태의 manual/ai 관계를 표시합니다.
 *
 * 목록이 비어 있어도 사용자가 직접 Related Note를 추가할 수 있도록
 * 섹션 자체는 유지합니다.
 *
 * 일일 AI 추천 제한을 적용받는 사용자는 오늘의 사용량도 함께 표시하며,
 * ADMIN처럼 제한을 적용받지 않는 사용자는 recommendationUsage가 null이므로
 * 별도의 role 판별 없이 사용량을 표시하지 않습니다.
 *
 * @param props Related Notes를 조회할 기준 Note ID
 */
export function RelatedNotesSection({ noteId }: RelatedNotesSectionProps) {
  const { data, isError, isLoading, isPollingTimedOut } =
    useRelatedNotes(noteId);

  if (isLoading) {
    return null;
  }

  // 현재 Note에 연결된 active 상태의 Related Notes 목록입니다.
  const relatedNotes = data?.relatedNotes ?? [];

  // 최신 execution claim이 running이면 AI 추천 진행 상태를 표시합니다.
  const hasRunningRecommendationExecution =
    data?.hasRunningRecommendationExecution === true;

  // 최신 execution claim이 failed이면 AI 추천 실패 상태를 표시합니다.
  const hasFailedRecommendationExecution =
    data?.hasFailedRecommendationExecution === true;

  /*
   * 일반 사용자는 오늘의 AI 추천 사용량과 제한을 전달받습니다.
   *
   * 일일 제한을 적용받지 않는 ADMIN은 queries 계층에서 null을 반환하므로
   * 이 컴포넌트에서는 사용자 role을 다시 확인하지 않습니다.
   */
  const recommendationUsage = data?.recommendationUsage ?? null;

  // 오늘 사용량이 일일 제한에 도달했는지 확인합니다.
  const hasReachedRecommendationLimit =
    recommendationUsage !== null &&
    recommendationUsage.used >= recommendationUsage.limit;

  return (
    <section className="border-t border-border/60 pt-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">관련 노트</h2>
        </div>

        <div className="flex min-w-0 items-center gap-3">
          {isPollingTimedOut ? (
            /*
             * execution claim은 아직 running이지만 자동 polling은 종료된 상태입니다.
             *
             * 실제 실행이 계속되고 있는지 중단됐는지는 이 화면에서 확정할 수 없으므로
             * 실패로 표시하지 않고 처리 시간이 길어지고 있음을 안내합니다.
             */
            <p className="text-xs text-muted-foreground">
              관련 노트 생성이 예상보다 오래 걸리고 있어요.
            </p>
          ) : hasRunningRecommendationExecution ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>관련 노트를 찾고 있어요</span>

              <span className="flex gap-0.5">
                <span className="animate-bounce">.</span>
                <span className="animate-bounce [animation-delay:150ms]">
                  .
                </span>
                <span className="animate-bounce [animation-delay:300ms]">
                  .
                </span>
              </span>
            </div>
          ) : hasFailedRecommendationExecution ? (
            <p className="text-xs text-muted-foreground">
              관련 노트 추천에 실패했습니다.
            </p>
          ) : recommendationUsage ? (
            hasReachedRecommendationLimit ? (
              /*
               * 일일 제한 도달은 실행 실패와 다른 정상적인 quota 상태입니다.
               *
               * 현재 Note의 AI 추천을 더 생성할 수 없다는 점과
               * 오늘 사용한 횟수를 함께 표시합니다.
               */
              <p className="text-xs text-muted-foreground">
                {`오늘은 이 노트의 AI 추천을 더 생성할 수 없어요. (${recommendationUsage.used}/${recommendationUsage.limit})`}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                오늘 {recommendationUsage.used}/{recommendationUsage.limit}회
                사용
              </p>
            )
          ) : null}

          <AddRelatedNoteDialog noteId={noteId} />
        </div>
      </div>

      {isError ? (
        <div className="mt-4 rounded-lg border border-dashed px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            관련 노트를 불러오지 못했습니다.
          </p>
        </div>
      ) : relatedNotes.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            아직 연결된 관련 노트가 없습니다.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {relatedNotes.map((relatedNote) => (
            <RelatedNoteItem
              key={relatedNote.noteId}
              noteId={noteId}
              relatedNote={relatedNote}
            />
          ))}
        </div>
      )}
    </section>
  );
}
