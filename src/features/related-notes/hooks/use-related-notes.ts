"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { relatedNotesQueryKeys } from "../constants/query-keys";
import { getRelatedNotes } from "../queries";

const RELATED_NOTES_AI_POLLING_INTERVAL_MS = 5_000;

/*
 * Related Notes AI 추천 실행은 route의 maxDuration = 90초까지 실행될 수 있으므로,
 * 정상적으로 오래 걸린 실행의 완료 상태를 놓치지 않도록
 * 여유 시간을 포함해 최대 110초까지 polling합니다.
 */
const RELATED_NOTES_AI_POLLING_TIMEOUT_MS = 110_000;

/**
 * 지정한 Note의 현재 Related Notes를 조회합니다.
 *
 * active 상태의 manual/ai 관계만 조회하며,
 * Related Notes 영역에서 독립적으로 로딩/에러 상태를 관리합니다.
 *
 * 새 AI 추천 실행이 claimed되면 Action이 반환한 Claim ID를 직접 추적합니다.
 * 따라서 Claim이 running 상태에서 매우 빠르게 terminal 상태로 전환되어
 * Client polling이 running을 한 번도 관찰하지 못하더라도,
 * 동일 Claim ID의 succeeded/failed/stale 상태를 확인해 polling을 종료합니다.
 *
 * 페이지 진입 시 이미 running 상태인 execution claim이 존재하는 경우에도
 * 해당 Claim을 발견한 시점부터 동일하게 polling을 시작합니다.
 *
 * polling은 최대 110초 동안 수행하며,
 * timeout 이후에도 execution claim이 running이면
 * 더 이상 자동 갱신하지 않고 timeout 상태를 호출자에게 전달합니다.
 *
 * timeout된 동일 Claim은 다시 자동 추적하지 않으며,
 * 이후 새 Claim이 생성되면 새로운 polling window를 시작할 수 있습니다.
 *
 * @param noteId Related Notes를 조회할 기준 Note ID
 */
export function useRelatedNotes(noteId: string) {
  /*
   * 현재 Client가 완료 상태를 추적하고 있는 execution Claim ID입니다.
   *
   * 수동 요청에서 새 Claim이 생성되면 Action 결과의 Claim ID를 저장하며,
   * 페이지 진입 시 이미 running인 Claim을 발견한 경우에도 해당 ID를 사용합니다.
   */
  const [trackedClaimId, setTrackedClaimId] = useState<string | null>(null);

  /*
   * 현재 Note에서 polling timeout이 발생한 execution Claim ID입니다.
   *
   * timeout으로 polling을 종료한 뒤에도 DB에는 같은 Claim이 잠시 running으로
   * 남아 있을 수 있으므로, 동일 Claim을 다시 자동 추적하지 않기 위해 기억합니다.
   *
   * 새 Claim을 직접 요청하거나 다른 Note로 이동하면 초기화합니다.
   */
  const [timedOutClaimId, setTimedOutClaimId] = useState<string | null>(null);

  /*
   * pollingStartedAt이 존재하는 동안 자동 재조회를 수행합니다.
   *
   * timeout은 Note 진입 시점이 아니라 실제 실행 추적을 시작한 시점부터 계산합니다.
   */
  const [pollingStartedAt, setPollingStartedAt] = useState<number | null>(null);
  const [isPollingTimedOut, setIsPollingTimedOut] = useState(false);

  useEffect(() => {
    /*
     * 다른 Note로 이동하면 이전 Note에서 추적하던 Claim과 polling 상태를
     * 모두 제거합니다.
     *
     * 이전 Note에서 timeout된 Claim도 새 Note에는 의미가 없으므로 함께 초기화합니다.
     *
     * 새 Note에 이미 running Claim이 있다면 최초 조회 후 아래 effect에서
     * 해당 Claim을 새로운 추적 대상으로 등록합니다.
     */
    setTrackedClaimId(null);
    setTimedOutClaimId(null);
    setPollingStartedAt(null);
    setIsPollingTimedOut(false);
  }, [noteId]);

  const query = useQuery({
    queryKey: relatedNotesQueryKeys.byNoteId(noteId),
    queryFn: () => getRelatedNotes(noteId),

    // Note ID가 준비된 경우에만 Related Notes 조회를 실행합니다.
    enabled: Boolean(noteId),

    /*
     * 실제 추적 중인 Claim이 존재하는 동안에만 주기적으로 상태를 다시 조회합니다.
     */
    refetchInterval: () =>
      Boolean(noteId) && pollingStartedAt !== null
        ? RELATED_NOTES_AI_POLLING_INTERVAL_MS
        : false,
    refetchIntervalInBackground: false,
  });

  const latestRecommendationExecution =
    query.data?.latestRecommendationExecution ?? null;

  const hasRunningRecommendationExecution =
    query.data?.hasRunningRecommendationExecution === true;

  useEffect(() => {
    /*
     * 수동 요청에서 아직 Claim을 직접 추적하고 있지 않은 상태에서
     * 현재 Note version의 running Claim이 발견되면 해당 실행을 추적합니다.
     *
     * 다른 탭에서 시작된 실행이나 duplicate 요청이 기존 running Claim을
     * 가리키는 경우에도 이 경로를 통해 polling이 시작됩니다.
     *
     * 단, 이전 polling window에서 이미 timeout된 동일 Claim은 다시 추적하지 않습니다.
     * 그렇지 않으면 timeout 직후 trackedClaimId가 null이 된 순간
     * 같은 running Claim을 다시 발견해 polling이 무한히 재시작될 수 있습니다.
     */
    if (trackedClaimId === null) {
      if (
        latestRecommendationExecution?.status === "running" &&
        latestRecommendationExecution.id !== timedOutClaimId
      ) {
        setTrackedClaimId(latestRecommendationExecution.id);
        setPollingStartedAt((current) => current ?? Date.now());
        setIsPollingTimedOut(false);
      }

      return;
    }

    /*
     * 아직 현재 query에서 추적 중인 Claim을 확인하지 못했다면
     * 다음 polling까지 기다립니다.
     *
     * 정상적인 동일 Note version 실행에서는 새 Claim의 동시 생성이
     * Claim 계층에서 방지되므로, 추적 중인 Claim이 최신 Claim이어야 합니다.
     */
    if (
      latestRecommendationExecution === null ||
      latestRecommendationExecution.id !== trackedClaimId
    ) {
      return;
    }

    /*
     * 추적 중인 Claim이 terminal 상태가 되면 실행이 완료된 것입니다.
     *
     * running을 Client가 한 번도 관찰하지 못했더라도
     * 동일 Claim ID가 succeeded/failed/stale이면 즉시 polling을 종료합니다.
     */
    if (latestRecommendationExecution.status !== "running") {
      setTrackedClaimId(null);
      setPollingStartedAt(null);
      setIsPollingTimedOut(false);
    }
  }, [latestRecommendationExecution, timedOutClaimId, trackedClaimId]);

  useEffect(() => {
    if (pollingStartedAt === null || trackedClaimId === null) {
      return;
    }

    /*
     * timeout은 실제 Claim 추적 시작 시점을 기준으로 합니다.
     *
     * 정상 완료 상태를 발견하면 위 effect에서 pollingStartedAt을 null로
     * 변경하므로 timeout을 기다리지 않고 즉시 자동 조회가 종료됩니다.
     */
    const elapsedMs = Date.now() - pollingStartedAt;
    const remainingMs = Math.max(
      RELATED_NOTES_AI_POLLING_TIMEOUT_MS - elapsedMs,
      0,
    );

    const timeoutId = window.setTimeout(() => {
      /*
       * timeout된 Claim ID를 먼저 기억한 뒤 polling 상태를 제거합니다.
       *
       * DB에 동일 Claim이 계속 running으로 남아 있더라도
       * 위 자동 추적 effect가 같은 Claim을 다시 polling 대상으로 등록하지 않습니다.
       */
      setTimedOutClaimId(trackedClaimId);
      setPollingStartedAt(null);
      setTrackedClaimId(null);
      setIsPollingTimedOut(true);
    }, remainingMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pollingStartedAt, trackedClaimId]);

  /**
   * 새 AI Related Notes 추천 실행 Claim 추적을 시작합니다.
   *
   * Action에서 `claimed` 결과와 함께 받은 Claim ID를 사용하므로,
   * `after()` 실행이 빠르게 완료되어 Client가 running 상태를 놓치더라도
   * 동일 Claim의 terminal 상태를 식별할 수 있습니다.
   *
   * 사용자가 새 추천을 요청해 새로운 Claim을 받은 경우에는
   * 이전 Claim의 timeout 정보도 더 이상 필요하지 않으므로 초기화합니다.
   *
   * @param claimId 이번 수동 요청에서 새로 생성된 execution Claim ID
   */
  const startRecommendationPolling = useCallback((claimId: string) => {
    setTimedOutClaimId(null);
    setTrackedClaimId(claimId);
    setPollingStartedAt(Date.now());
    setIsPollingTimedOut(false);
  }, []);

  return {
    ...query,

    /**
     * 현재 AI 추천 execution Claim의 완료 상태를 자동으로 추적하고 있는지 나타냅니다.
     *
     * UI에서는 이 값을 사용해 polling 중 동일 추천 요청을 다시 보내지 못하도록 합니다.
     */
    isRecommendationPolling: pollingStartedAt !== null,

    startRecommendationPolling,

    /*
     * polling timeout 자체와 실제 execution 상태는 서로 다른 개념입니다.
     *
     * timeout 이후에도 DB의 최신 execution claim이 running일 때만
     * UI에 "자동 갱신이 종료된 실행 중 상태"를 노출합니다.
     */
    isPollingTimedOut: isPollingTimedOut && hasRunningRecommendationExecution,
  };
}
