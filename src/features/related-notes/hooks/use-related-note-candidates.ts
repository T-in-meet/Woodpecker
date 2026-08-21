"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { relatedNotesQueryKeys } from "../constants/query-keys";
import { getRelatedNoteCandidates } from "../queries";

type UseRelatedNoteCandidatesParams = {
  /** Related Note를 추가할 기준 Note ID입니다. */
  noteId: string;

  /** 현재 조회할 후보 페이지입니다. */
  page: number;

  /** 후보 Note 제목 검색어입니다. */
  search: string;

  /** 페이지당 조회할 후보 수입니다. */
  pageSize?: number;
};

/**
 * 수동 Related Note 추가 Dialog에 표시할 후보 Note 목록을 조회합니다.
 *
 * 후보 목록은 서버에서 다음 Note를 제외한 뒤 반환합니다.
 *
 * - 현재 Note 자신
 * - 이미 사용자가 직접 연결한 Note
 * - 현재 active 상태인 AI 추천 Note
 * - 사용자가 dismissed한 AI 추천 Note
 *
 * 페이지, 검색어, 페이지 크기는 Query key에도 포함되므로
 * 각 조회 조건별 결과를 TanStack Query가 독립적으로 캐시합니다.
 *
 * @param params Related Note 후보 조회 조건
 */
export function useRelatedNoteCandidates({
  noteId,
  page,
  search,
  pageSize = 8,
}: UseRelatedNoteCandidatesParams) {
  return useQuery({
    queryKey: relatedNotesQueryKeys.candidates(noteId, page, search, pageSize),
    queryFn: () => getRelatedNoteCandidates(noteId, page, search, pageSize),
    placeholderData: keepPreviousData,

    // 기준 Note ID가 준비된 경우에만 후보 조회를 실행합니다.
    enabled: Boolean(noteId),
  });
}
