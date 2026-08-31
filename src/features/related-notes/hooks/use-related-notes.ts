"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { relatedNotesQueryKeys } from "../constants/query-keys";
import {
  getRelatedNoteRecommendationExecutionClaim,
  getRelatedNotes,
} from "../queries";

const RELATED_NOTES_AI_POLLING_INTERVAL_MS = 5_000;

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

  useEffect(() => {
    /*
     * 다른 Note로 이동하면 이전 Note에서 추적하던 Claim을 제거합니다.
     *
     * 새 Note에 이미 running Claim이 있다면 최초 조회 후 아래 effect에서
     * 해당 Claim을 새로운 추적 대상으로 등록합니다.
     */
    setTrackedClaimId(null);
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
    queryFn: () => {
      if (trackedClaimId === null) {
        return null;
      }

      return getRelatedNoteRecommendationExecutionClaim(noteId, trackedClaimId);
    },
    enabled: Boolean(noteId) && trackedClaimId !== null,

    /*
     * tracked Claim이 존재하는 동안에는 Claim ID를 기준으로 상태를 다시 조회합니다.
     *
     * 조회 실패는 query error로 분리되므로 trackedClaimId를 임의로 해제하지 않고,
     * 이후 polling에서 DB 상태를 다시 확인합니다.
     */
    refetchInterval:
      Boolean(noteId) && trackedClaimId !== null
        ? RELATED_NOTES_AI_POLLING_INTERVAL_MS
        : false,
    refetchIntervalInBackground: false,
  });

  useEffect(() => {
    /*
     * 수동 요청에서 아직 Claim을 직접 추적하고 있지 않은 상태에서
     * 현재 Note version의 running Claim이 발견되면 해당 실행을 추적합니다.
     *
     * 다른 탭에서 시작된 실행이나 duplicate 요청이 기존 running Claim을
     * 가리키는 경우에도 이 경로를 통해 polling을 시작합니다.
     */
    if (
      trackedClaimId === null &&
      latestRecommendationExecution?.status === "running"
    ) {
      setTrackedClaimId(latestRecommendationExecution.id);
    }
  }, [latestRecommendationExecution, trackedClaimId]);

  useEffect(() => {
    if (trackedClaimId === null) {
      return;
    }

    /*
     * tracked Claim 조회 자체가 실패한 경우에는 실행 상태를 판정할 수 없습니다.
     *
     * 일시적인 DB/서버 오류를 실행 완료로 오인하지 않도록 추적 상태를 유지하고,
     * 이후 polling에서 다시 확인합니다.
     */
    if (trackedClaimQuery.isError) {
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
     *
     * DB 조회/파싱 실패는 위의 error 경로로 분리되므로
     * null을 실행 상태 조회 실패와 혼동하지 않습니다.
     */
    if (trackedRecommendationExecution === null) {
      setTrackedClaimId(null);
      void query.refetch();
      return;
    }

    /*
     * tracked Claim이 아직 running 상태라면 다음 polling 결과를 기다립니다.
     *
     * 현재 Note version의 latest execution과 비교하지 않으므로,
     * 추천 실행 중 Note가 수정되어 source version이 변경되어도
     * tracked Claim lifecycle 추적은 유지됩니다.
     */
    if (trackedRecommendationExecution.status === "running") {
      return;
    }

    /*
     * tracked Claim이 succeeded/failed/stale terminal 상태가 되면
     * 해당 실행의 추적을 종료합니다.
     *
     * 이후 main Related Notes Query를 다시 조회하여
     * Related Notes 목록, 현재 Note version의 execution 상태,
     * 일일 recommendation usage를 최종 DB 상태와 동기화합니다.
     */
    setTrackedClaimId(null);
    void query.refetch();
  }, [
    query,
    trackedClaimId,
    trackedClaimQuery.data,
    trackedClaimQuery.isError,
    trackedClaimQuery.isFetched,
  ]);

  /**
   * 새 AI Related Notes 추천 실행 Claim 추적을 시작합니다.
   *
   * Action에서 `claimed` 결과와 함께 받은 Claim ID를 직접 사용하므로,
   * `after()` 실행이 빠르게 완료되어 Client가 running 상태를 놓치더라도
   * 동일 Claim의 terminal 상태를 식별할 수 있습니다.
   *
   * 또한 Claim ID 기반 조회는 현재 Note version과 독립적이므로,
   * 실행 중 Note가 수정되더라도 기존 실행의 완료 여부를 계속 추적합니다.
   *
   * @param claimId 이번 수동 요청에서 새로 생성된 execution Claim ID
   */
  const startRecommendationPolling = useCallback((claimId: string) => {
    setTrackedClaimId(claimId);
  }, []);

  return {
    ...query,

    /**
     * 현재 AI 추천 execution Claim의 완료 상태를 자동으로 추적하고 있는지 나타냅니다.
     *
     * UI에서는 이 값을 사용해 polling 중 동일 추천 요청을 다시 보내지 못하도록 하고,
     * 실행 중 페이지 이탈 경고를 유지합니다.
     */
    isRecommendationPolling: trackedClaimId !== null,

    startRecommendationPolling,
  };
}
