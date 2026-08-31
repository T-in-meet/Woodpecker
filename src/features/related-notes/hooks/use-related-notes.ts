"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { relatedNotesQueryKeys } from "../constants/query-keys";
import { getRelatedNotes } from "../queries";

const RELATED_NOTES_AI_POLLING_INTERVAL_MS = 5_000;

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
 * 해당 Claim을 발견하면 동일하게 polling을 시작합니다.
 *
 * Claim의 stale 여부는 Client 시간으로 판정하지 않습니다.
 * getRelatedNotes 조회 경로에서 DB가 만료 running Claim을 stale로 정리하고,
 * Client는 DB가 반환한 execution 상태가 terminal인지 여부만 확인합니다.
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

  useEffect(() => {
    /*
     * 다른 Note로 이동하면 이전 Note에서 추적하던 Claim을 제거합니다.
     *
     * 새 Note에 이미 running Claim이 있다면 최초 조회 후 아래 effect에서
     * 해당 Claim을 새로운 추적 대상으로 등록합니다.
     */
    setTrackedClaimId(null);
  }, [noteId]);

  const query = useQuery({
    queryKey: relatedNotesQueryKeys.byNoteId(noteId),
    queryFn: () => getRelatedNotes(noteId),

    // Note ID가 준비된 경우에만 Related Notes 조회를 실행합니다.
    enabled: Boolean(noteId),

    /*
     * 실제 추적 중인 Claim이 존재하는 동안에만 주기적으로 상태를 다시 조회합니다.
     *
     * stale 판정은 getRelatedNotes가 호출하는 DB cleanup RPC가 담당하므로,
     * Client는 별도의 timeout 시간을 계산하지 않습니다.
     */
    refetchInterval: () =>
      Boolean(noteId) && trackedClaimId !== null
        ? RELATED_NOTES_AI_POLLING_INTERVAL_MS
        : false,
    refetchIntervalInBackground: false,
  });

  const latestRecommendationExecution =
    query.data?.latestRecommendationExecution ?? null;

  useEffect(() => {
    /*
     * 수동 요청에서 아직 Claim을 직접 추적하고 있지 않은 상태에서
     * 현재 Note version의 running Claim이 발견되면 해당 실행을 추적합니다.
     *
     * 다른 탭에서 시작된 실행이나 duplicate 요청이 기존 running Claim을
     * 가리키는 경우에도 이 경로를 통해 polling이 시작됩니다.
     */
    if (trackedClaimId === null) {
      if (latestRecommendationExecution?.status === "running") {
        setTrackedClaimId(latestRecommendationExecution.id);
      }

      return;
    }

    /*
     * 아직 현재 query에서 추적 중인 Claim을 확인하지 못했다면
     * 다음 polling까지 기다립니다.
     *
     * 수동 요청 직후에는 query가 이전 Claim 상태를 가지고 있을 수 있으므로,
     * 추적 중인 Claim ID와 일치하는 응답이 올 때까지 polling을 유지합니다.
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
     *
     * stale 여부 자체는 DB에서 결정하며 Client는 그 결과만 소비합니다.
     */
    if (latestRecommendationExecution.status !== "running") {
      setTrackedClaimId(null);
    }
  }, [latestRecommendationExecution, trackedClaimId]);

  /**
   * 새 AI Related Notes 추천 실행 Claim 추적을 시작합니다.
   *
   * Action에서 `claimed` 결과와 함께 받은 Claim ID를 사용하므로,
   * `after()` 실행이 빠르게 완료되어 Client가 running 상태를 놓치더라도
   * 동일 Claim의 terminal 상태를 식별할 수 있습니다.
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
     * UI에서는 이 값을 사용해 polling 중 동일 추천 요청을 다시 보내지 못하도록 합니다.
     */
    isRecommendationPolling: trackedClaimId !== null,

    startRecommendationPolling,
  };
}
