"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { relatedNotesQueryKeys } from "../constants/query-keys";
import { getRelatedNotes } from "../queries";

const RELATED_NOTES_AI_POLLING_INTERVAL_MS = 5_000;

/*
 * Related Notes 후처리는 route의 maxDuration = 90초까지 실행될 수 있으므로,
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
 * AI Related Notes 추천은 Note 저장 응답 이후 비동기로 저장되므로,
 * execution claim이 running 상태인 동안 최대 110초까지
 * 5초 간격으로 Related Notes를 재조회합니다.
 *
 * @param noteId Related Notes를 조회할 기준 Note ID
 */
export function useRelatedNotes(noteId: string) {
  const [isPollingEnabled, setIsPollingEnabled] = useState(true);

  useEffect(() => {
    setIsPollingEnabled(true);

    const timeoutId = window.setTimeout(() => {
      setIsPollingEnabled(false);
    }, RELATED_NOTES_AI_POLLING_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [noteId]);

  return useQuery({
    queryKey: relatedNotesQueryKeys.byNoteId(noteId),
    queryFn: () => getRelatedNotes(noteId),

    // Note ID가 준비된 경우에만 Related Notes 조회를 실행합니다.
    enabled: Boolean(noteId),

    /*
     * AI 추천 실행 상태는 execution claim을 기준으로 판단합니다.
     * running 상태인 동안 최대 110초까지 5초 간격으로 다시 조회합니다.
     */
    refetchInterval: (query) =>
      Boolean(noteId) &&
      isPollingEnabled &&
      query.state.data?.hasRunningRecommendationExecution === true
        ? RELATED_NOTES_AI_POLLING_INTERVAL_MS
        : false,
    refetchIntervalInBackground: false,
  });
}
