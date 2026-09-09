"use client";

import { FeatureInfoPopover } from "@/components/common/FeatureInfoPopover";
import { NavigationGuardAlertDialog } from "@/components/common/NavigationGuardAlertDialog";
import { Button } from "@/components/ui/button";
import { useBeforeUnloadGuard } from "@/hooks/useBeforeUnloadGuard";
import { useInternalNavigationGuard } from "@/hooks/useInternalNavigationGuard";

import {
  RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT,
  RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE,
} from "../constants/ai";
import { useRelatedNotes } from "../hooks/use-related-notes";
import { useRequestRelatedNoteRecommendation } from "../hooks/use-request-related-note-recommendation";
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
 * 목록이 비어 있어도 사용자가 직접 Related Note를 추가하거나
 * AI Related Notes 추천 생성을 요청할 수 있도록 섹션 자체는 유지합니다.
 *
 * AI 추천은 사용자의 수동 요청으로 시작하며,
 * 요청이 받아들여진 뒤 실제 추천 생성은 비동기로 실행됩니다.
 *
 * 현재 Note version에 대해 이미 성공한 AI 추천 실행이 존재하면
 * 동일한 version으로 다시 추천을 생성하지 않고 최신 상태로 표시합니다.
 *
 * 일일 AI 추천 제한을 적용받는 사용자는 현재 Note의 요청 가능 여부와
 * 사용자 전체 오늘 사용량을 함께 표시합니다.
 * ADMIN의 할당량 미적용과 일반 사용자의 할당량 조회 실패는
 * query가 반환하는 판별 상태로 구분합니다.
 *
 * @param props Related Notes를 조회할 기준 Note ID
 */
export function RelatedNotesSection({ noteId }: RelatedNotesSectionProps) {
  const {
    data,
    isError,
    isLoading,
    isRecommendationPolling,
    startRecommendationPolling,
  } = useRelatedNotes(noteId);

  /*
   * Action이 새 execution claim을 정상적으로 획득하면 query invalidate보다 먼저
   * 해당 Claim ID에 대한 polling을 시작합니다.
   *
   * duplicate/stale/daily limit처럼 새 Claim이 생성되지 않는 경우에는
   * polling을 시작하지 않고 최신 query 상태만 다시 조회합니다.
   */
  const requestRelatedNoteRecommendation = useRequestRelatedNoteRecommendation(
    noteId,
    {
      onAccepted: startRecommendationPolling,
    },
  );

  // 최신 execution claim이 running이면 AI 추천 진행 상태를 표시합니다.
  const hasRunningRecommendationExecution =
    data?.hasRunningRecommendationExecution === true;

  /*
   * 현재 Note version의 최신 execution claim이 succeeded이면
   * 이미 해당 version에 대한 AI 추천이 생성된 상태입니다.
   *
   * 동일한 Note version으로 다시 실행하면 Claim 계층에서 duplicate 처리되므로
   * UI에서도 새로운 요청이 가능한 것처럼 보이지 않도록 버튼을 비활성화합니다.
   */
  const hasSucceededRecommendationExecution =
    data?.latestRecommendationExecution?.status === "succeeded";

  /*
   * Server Action 요청 중이거나 추천 실행 상태를 polling하고 있는 동안에는
   * 사용자가 동일한 AI 추천을 다시 요청하지 못하도록 막습니다.
   *
   * 새 Claim이 생성되면 Action 응답에서 받은 Claim ID를 즉시 추적하므로
   * Client가 running 상태를 직접 관찰하지 못하더라도 완료 상태를 판정할 수 있습니다.
   */
  const isRecommendationRequestInProgress =
    requestRelatedNoteRecommendation.isPending || isRecommendationPolling;

  /*
   * 추천 요청을 서버에 전달하는 시점부터 background 실행이 종료될 때까지
   * 페이지 이탈 경고를 적용합니다.
   *
   * Server Action 요청 직후에는 DB query가 아직 running 상태를 반영하지 않았을 수 있으므로
   * 요청/polling 상태도 함께 사용합니다.
   */
  const shouldGuardNavigation =
    isRecommendationRequestInProgress || hasRunningRecommendationExecution;

  const { cancelNavigation, confirmNavigation, isNavigationPending } =
    useInternalNavigationGuard({
      enabled: shouldGuardNavigation,
    });

  useBeforeUnloadGuard({
    enabled: shouldGuardNavigation,
  });

  if (isLoading) {
    return null;
  }

  // 현재 Note에 연결된 active 상태의 Related Notes 목록입니다.
  const relatedNotes = data?.relatedNotes ?? [];

  // 최신 execution claim이 failed이면 AI 추천 실패 상태를 표시합니다.
  const hasFailedRecommendationExecution =
    data?.hasFailedRecommendationExecution === true;

  /*
   * query 계층의 판별 상태를 사용해 정상 quota, ADMIN 미적용,
   * 조회 실패를 별도의 UI 상태로 처리합니다.
   */
  const recommendationQuotaState = data?.recommendationQuota ?? {
    status: "unavailable" as const,
  };
  const recommendationQuota =
    recommendationQuotaState.status === "available"
      ? recommendationQuotaState.quota
      : null;
  const isRecommendationQuotaUnavailable =
    recommendationQuotaState.status === "unavailable";

  // DB가 판정한 사용자 전체 일일 추천 할당량 도달 상태를 사용합니다.
  const hasReachedUserRecommendationLimit =
    recommendationQuota?.isUserLimitReached === true;

  // DB가 판정한 현재 Note의 일일 추천 할당량 도달 상태를 사용합니다.
  const hasReachedNoteRecommendationLimit =
    recommendationQuota?.isNoteLimitReached === true;

  /*
   * 실행 요청 중이거나 실행 상태를 추적 중이거나,
   * DB에서 running 상태가 확인됐거나,
   * 현재 Note version에 대한 추천이 이미 성공했거나,
   * 일일 제한에 도달한 경우 새로운 AI 추천 요청을 막습니다.
   *
   * Claim의 stale 여부는 조회 경로의 DB cleanup에서 판정하므로,
   * Client에서는 별도의 timeout 상태를 사용하지 않습니다.
   */
  const isRecommendationRequestDisabled =
    isRecommendationRequestInProgress ||
    hasRunningRecommendationExecution ||
    hasSucceededRecommendationExecution ||
    isRecommendationQuotaUnavailable ||
    (recommendationQuota !== null && !recommendationQuota.canRequestForNote);

  /*
   * AI 추천의 현재 상태를 짧은 문구로 표시합니다.
   *
   * 실행 상태와 오류를 quota보다 우선하고,
   * 안정 상태에서는 사용자 전체 quota 소진 → 최신 상태 →
   * Note quota 소진 → 추천 가능 순서로 판정합니다.
   */
  const recommendationStatus = (() => {
    if (
      isRecommendationRequestInProgress ||
      hasRunningRecommendationExecution
    ) {
      return "관련 노트를 찾고 있어요...";
    }

    if (requestRelatedNoteRecommendation.isError) {
      return requestRelatedNoteRecommendation.error.message;
    }

    if (hasFailedRecommendationExecution) {
      return "관련 노트 추천에 실패했습니다.";
    }

    if (isRecommendationQuotaUnavailable) {
      return "AI 추천 가능 여부를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.";
    }

    if (hasReachedUserRecommendationLimit) {
      return "오늘 할당량 소진";
    }

    if (hasSucceededRecommendationExecution) {
      return "최신 상태";
    }

    if (hasReachedNoteRecommendationLimit) {
      return "오늘 추천 완료";
    }

    if (recommendationQuota !== null) {
      return "추천 가능";
    }

    return null;
  })();

  const handleRequestRelatedNoteRecommendation = () => {
    requestRelatedNoteRecommendation.mutate();
  };

  return (
    <>
      <NavigationGuardAlertDialog
        open={isNavigationPending}
        title="관련 노트를 생성하고 있습니다."
        description="페이지를 이동해도 관련 노트 생성은 계속됩니다. 이동하시겠습니까?"
        onCancel={cancelNavigation}
        onConfirm={confirmNavigation}
      />

      <section className="border-t border-border/60 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-1">
            <h2 className="shrink-0 text-sm font-semibold text-foreground">
              관련 노트
            </h2>

            <FeatureInfoPopover ariaLabel="관련 노트 안내">
              <div className="space-y-2">
                <p>
                  {`AI 관련 노트 추천은 노트마다 하루 ${recommendationQuota?.noteLimit ?? RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT_PER_NOTE}회, 사용자당 하루 최대 ${recommendationQuota?.userLimit ?? RELATED_NOTES_DAILY_RECOMMENDATION_LIMIT}회 사용할 수 있으며 매일 자정(KST)에 초기화됩니다.`}
                </p>
              </div>
            </FeatureInfoPopover>
          </div>

          <div className="flex min-w-0 flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
            {recommendationStatus ? (
              <p className="order-2 min-w-0 max-w-full whitespace-normal break-words text-right text-xs text-muted-foreground sm:order-1">
                {recommendationStatus}

                {recommendationQuota !== null ? (
                  <>
                    {" · 오늘 "}
                    {recommendationQuota.userUsed}/
                    {recommendationQuota.userLimit}회
                  </>
                ) : null}
              </p>
            ) : null}

            <div className="order-1 flex shrink-0 items-center gap-2 sm:order-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isRecommendationRequestDisabled}
                onClick={handleRequestRelatedNoteRecommendation}
              >
                AI 추천
              </Button>

              <AddRelatedNoteDialog noteId={noteId} />
            </div>
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
    </>
  );
}
