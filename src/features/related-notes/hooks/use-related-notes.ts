"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { relatedNotesQueryKeys } from "../constants/query-keys";
import {
  getRelatedNoteRecommendationExecutionClaim,
  getRelatedNotes,
} from "../queries";

const RELATED_NOTES_AI_POLLING_INTERVAL_MS = 5_000;
const RELATED_NOTES_AI_POLLING_MAX_CONSECUTIVE_ERRORS = 3;

/**
 * 지정한 Note의 현재 Related Notes를 조회합니다.
 *
 * active 상태의 manual/ai 관계만 조회하며,
 * Related Notes 영역에서 독립적으로 로딩/에러 상태를 관리합니다.
 *
 * 현재 Note version의 실행 상태와 특정 execution Claim의 lifecycle 추적을
 * 서로 분리합니다.
 *
 * getRelatedNotes는 현재 Note version의 최신 실행 상태를 조회하고,
 * 새 AI 추천 실행이 claimed되면 Action이 반환한 Claim ID를 별도로 추적합니다.
 *
 * 따라서 추천 실행 중 Note가 수정되어 source_updated_at이 변경되더라도,
 * 이미 추적 중인 Claim은 현재 Note version과 독립적으로
 * succeeded/failed/stale 상태가 될 때까지 계속 확인할 수 있습니다.
 *
 * 페이지 진입 시 현재 Note version에 이미 running Claim이 존재하는 경우에도
 * 해당 Claim ID를 추적 대상으로 등록합니다.
 *
 * Claim의 stale 여부는 Client 시간으로 판정하지 않습니다.
 * tracked Claim 조회 경로에서 DB stale cleanup을 수행하며,
 * Client는 DB가 반환한 execution 상태만 소비합니다.
 *
 * @param noteId Related Notes를 조회할 기준 Note ID
 */
export function useRelatedNotes(noteId: string) {
  /*
   * 현재 Client가 완료 상태를 추적하고 있는 execution Claim ID입니다.
   *
   * 수동 요청에서 새 Claim이 생성되면 Action 결과의 Claim ID를 저장하며,
   * 페이지 진입 시 현재 Note version의 running Claim을 발견한 경우에도
   * 해당 ID를 사용합니다.
   */
  const [trackedClaimId, setTrackedClaimId] = useState<string | null>(null);

  /*
   * 연속 조회 실패로 Client 추적을 포기한 Claim ID입니다.
   *
   * main Related Notes Query에 동일 Claim이 running으로 남아 있더라도
   * 곧바로 다시 자동 추적하여 UI가 재잠금되는 것을 방지합니다.
   */
  const [abandonedClaimId, setAbandonedClaimId] = useState<string | null>(null);

  /*
   * tracked Claim 조회 요청의 연속 실패 횟수입니다.
   *
   * React Query의 retry/failureCount가 아니라
   * 실제 Claim 상태 조회 요청 자체의 성공/실패를 기준으로 계산합니다.
   *
   * 실패하면 1 증가하고,
   * 정상적으로 조회되면 즉시 0으로 초기화합니다.
   */
  const consecutiveClaimQueryErrorCountRef = useRef(0);

  useEffect(() => {
    /*
     * 다른 Note로 이동하면 이전 Note에서 추적하던 Claim과
     * 추적 포기 상태를 모두 제거합니다.
     */
    setTrackedClaimId(null);
    setAbandonedClaimId(null);
    consecutiveClaimQueryErrorCountRef.current = 0;
  }, [noteId]);

  /*
   * 현재 Note version의 Related Notes 목록과 실행 UI 상태를 조회합니다.
   *
   * 특정 Claim의 완료 추적은 아래 trackedClaimQuery가 담당하므로
   * 이 Query 자체는 polling하지 않습니다.
   */
  const query = useQuery({
    queryKey: relatedNotesQueryKeys.byNoteId(noteId),
    queryFn: () => getRelatedNotes(noteId),

    // Note ID가 준비된 경우에만 Related Notes 조회를 실행합니다.
    enabled: Boolean(noteId),
  });

  const latestRecommendationExecution =
    query.data?.latestRecommendationExecution ?? null;

  /*
   * 이미 추적을 시작한 특정 execution Claim의 상태를 조회합니다.
   *
   * Claim ID로 직접 조회하므로 추천 실행 중 Note의 source_updated_at이 변경되어도
   * 기존 Claim의 lifecycle을 계속 추적할 수 있습니다.
   *
   * stale 판정과 cleanup은 Server query/DB에서 담당하며,
   * Client는 별도의 timeout을 계산하지 않습니다.
   */
  const trackedClaimQuery = useQuery({
    queryKey: relatedNotesQueryKeys.executionClaim(
      noteId,
      trackedClaimId ?? "",
    ),

    queryFn: async () => {
      if (trackedClaimId === null) {
        return null;
      }

      try {
        const result = await getRelatedNoteRecommendationExecutionClaim(
          noteId,
          trackedClaimId,
        );

        /*
         * Claim 상태를 정상적으로 조회했다면
         * 이전 조회 실패와의 연속성이 끊긴 것입니다.
         */
        consecutiveClaimQueryErrorCountRef.current = 0;

        return result;
      } catch (error) {
        /*
         * React Query 내부 retry 횟수와 관계없이
         * 실제 Claim 상태 조회 요청 실패를 한 번으로 계산합니다.
         */
        consecutiveClaimQueryErrorCountRef.current += 1;

        throw error;
      }
    },

    enabled: Boolean(noteId) && trackedClaimId !== null,

    /*
     * Claim polling 한 번을 하나의 조회 시도로 취급하므로
     * React Query 내부 retry는 사용하지 않습니다.
     */
    retry: false,

    /*
     * tracked Claim이 존재하는 동안에는 Claim ID를 기준으로 상태를 다시 조회합니다.
     *
     * 일시적인 조회 실패는 허용하지만,
     * 연속 실패가 허용 횟수에 도달하면 Client 추적만 종료합니다.
     */
    refetchInterval:
      Boolean(noteId) && trackedClaimId !== null
        ? RELATED_NOTES_AI_POLLING_INTERVAL_MS
        : false,

    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    /*
     * 아직 직접 추적 중인 Claim이 없고,
     * 현재 Note version에 running Claim이 존재한다면 해당 Claim을 추적합니다.
     *
     * 단, 조회 실패로 Client 추적을 포기했던 동일 Claim은
     * 다시 자동 추적하지 않습니다.
     */
    if (
      trackedClaimId === null &&
      latestRecommendationExecution?.status === "running" &&
      latestRecommendationExecution.id !== abandonedClaimId
    ) {
      /*
       * 새 Claim lifecycle 추적을 시작하므로
       * 이전 Claim의 조회 실패 횟수를 제거합니다.
       */
      consecutiveClaimQueryErrorCountRef.current = 0;

      setTrackedClaimId(latestRecommendationExecution.id);
    }
  }, [abandonedClaimId, latestRecommendationExecution, trackedClaimId]);

  useEffect(() => {
    if (trackedClaimId === null) {
      return;
    }

    /*
     * tracked Claim 조회 자체가 실패한 경우에는
     * 실제 execution 상태를 판정할 수 없습니다.
     *
     * 실제 Claim 상태 조회 요청이 연속 3회 실패했다면
     * 해당 Claim의 Client 추적만 포기합니다.
     *
     * polling 실패는 AI execution 실패가 아니므로
     * Server Claim 상태는 변경하지 않습니다.
     */
    if (trackedClaimQuery.isError) {
      if (
        consecutiveClaimQueryErrorCountRef.current >=
        RELATED_NOTES_AI_POLLING_MAX_CONSECUTIVE_ERRORS
      ) {
        /*
         * 먼저 포기한 Claim을 기록한 뒤 tracked Claim을 제거합니다.
         *
         * main query가 여전히 동일 Claim을 running으로 가지고 있더라도
         * abandonedClaimId 비교로 자동 재추적되지 않습니다.
         */
        setAbandonedClaimId(trackedClaimId);
        setTrackedClaimId(null);

        toast.error(
          "AI 추천 실행 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
        );
      }

      return;
    }

    /*
     * 아직 tracked Claim의 최초 조회가 완료되지 않았다면
     * 실행 상태를 판정하지 않고 기다립니다.
     */
    if (!trackedClaimQuery.isFetched) {
      return;
    }

    const trackedRecommendationExecution = trackedClaimQuery.data ?? null;

    /*
     * Claim 조회가 정상적으로 완료됐지만 해당 Claim이 존재하지 않는 경우에는
     * 더 이상 추적할 execution이 없으므로 polling을 종료합니다.
     */
    if (trackedRecommendationExecution === null) {
      setTrackedClaimId(null);
      void query.refetch();
      return;
    }

    /*
     * tracked Claim이 아직 running 상태라면 다음 polling 결과를 기다립니다.
     */
    if (trackedRecommendationExecution.status === "running") {
      return;
    }

    /*
     * tracked Claim이 succeeded/failed/stale terminal 상태가 되면
     * 해당 실행의 추적을 종료합니다.
     *
     * 이후 main Related Notes Query를 다시 조회하여
     * Related Notes 목록, 실행 상태, 일일 usage를 DB와 동기화합니다.
     */
    setTrackedClaimId(null);
    void query.refetch();
  }, [
    query,
    trackedClaimId,
    trackedClaimQuery.data,
    trackedClaimQuery.errorUpdateCount,
    trackedClaimQuery.isError,
    trackedClaimQuery.isFetched,
  ]);

  /**
   * 새 AI Related Notes 추천 실행 Claim 추적을 시작합니다.
   *
   * Action에서 `claimed` 결과와 함께 받은 Claim ID를 직접 사용합니다.
   *
   * 사용자의 새로운 실행으로 추적을 시작하는 경우에는
   * 이전 Claim의 polling 포기 상태와 연속 조회 실패 횟수를 초기화합니다.
   *
   * @param claimId 이번 수동 요청에서 새로 생성된 execution Claim ID
   */
  const startRecommendationPolling = useCallback((claimId: string) => {
    setAbandonedClaimId(null);
    consecutiveClaimQueryErrorCountRef.current = 0;
    setTrackedClaimId(claimId);
  }, []);

  return {
    ...query,

    /**
     * 현재 AI 추천 execution Claim의 완료 상태를 자동으로 추적하고 있는지 나타냅니다.
     *
     * UI에서는 이 값을 사용해 polling 중 동일 추천 요청을 다시 보내지 못하도록 하고,
     * 실행 중 페이지 이탈 경고를 유지합니다.
     *
     * Claim 조회가 연속으로 실패해 Client 추적을 포기하면 false로 전환되어
     * UI 잠금과 페이지 이탈 경고를 해제합니다.
     */
    isRecommendationPolling: trackedClaimId !== null,

    startRecommendationPolling,
  };
}
