"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { relatedNotesQueryKeys } from "../constants/query-keys";
import { getRelatedNotes } from "../queries";

const RELATED_NOTES_AI_POLLING_INTERVAL_MS = 5_000;
const RELATED_NOTES_AI_POLLING_TIMEOUT_MS = 60_000;

/**
 * 지정한 Note의 현재 Related Notes를 조회합니다.
 *
 * active 상태의 manual/ai 관계만 조회하며,
 * Related Notes 영역에서 독립적으로 로딩/에러 상태를 관리합니다.
 *
 * AI Related Notes 추천은 Note 저장 응답 이후 비동기로 저장되므로,
 * 화면 진입 후 최대 60초 동안 5초 간격으로 Related Notes를 재조회합니다.
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
     * AI 추천은 비동기로 저장되므로 완료 시점을 클라이언트가 알 수 없습니다.
     * 화면 진입 후 최대 60초 동안만 5초 간격으로 다시 조회합니다.
     */
    refetchInterval: (query) =>
      Boolean(noteId) &&
      isPollingEnabled &&
      query.state.data?.hasRunningRecommendationRun === true
        ? RELATED_NOTES_AI_POLLING_INTERVAL_MS
        : false,
    refetchIntervalInBackground: false,
  });
}
