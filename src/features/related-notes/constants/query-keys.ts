export const relatedNotesQueryKeys = {
  /** Related Notes 관련 Query의 공통 최상위 key입니다. */
  all: ["related-notes"] as const,

  /**
   * 지정한 Note에 현재 연결된 Related Notes 목록의 Query key를 생성합니다.
   *
   * @param noteId Related Notes를 조회할 기준 Note ID
   */
  byNoteId: (noteId: string) =>
    [...relatedNotesQueryKeys.all, "note", noteId] as const,

  /**
   * 특정 Related Notes AI 추천 execution Claim의 Query key를 생성합니다.
   *
   * 현재 Note version의 최신 실행 상태와 별개로,
   * 이미 추적을 시작한 특정 Claim의 lifecycle을 조회할 때 사용합니다.
   *
   * @param noteId Claim이 속한 기준 Note ID
   * @param claimId 추적할 execution Claim ID
   */
  executionClaim: (noteId: string, claimId: string) =>
    [...relatedNotesQueryKeys.all, "execution-claim", noteId, claimId] as const,

  /**
   * 지정한 Note의 수동 Related Note 후보 목록에 대한 공통 Query key를 생성합니다.
   *
   * 페이지, 검색어, 페이지 크기와 관계없이 해당 Note의 모든 후보 Query를
   * 한 번에 invalidate할 때 사용합니다.
   *
   * @param noteId Related Note를 추가할 기준 Note ID
   */
  candidateList: (noteId: string) =>
    [...relatedNotesQueryKeys.all, "candidates", noteId] as const,

  /**
   * 수동 Related Note 추가에 사용할 후보 Note 목록의 Query key를 생성합니다.
   *
   * 후보 목록은 기준 Note뿐 아니라 현재 페이지, 검색어, 페이지 크기에 따라
   * 조회 결과가 달라지므로 모든 조회 조건을 Query key에 포함합니다.
   *
   * 이를 통해 조건이 변경될 때 TanStack Query가 서로 다른 캐시로 관리하고
   * 필요한 후보 목록을 다시 조회할 수 있습니다.
   *
   * @param noteId Related Note를 추가할 기준 Note ID
   * @param page 현재 조회할 페이지
   * @param search Note 제목 검색어
   * @param pageSize 페이지당 조회할 후보 수
   */
  candidates: (
    noteId: string,
    page: number,
    search: string,
    pageSize: number,
  ) =>
    [
      ...relatedNotesQueryKeys.candidateList(noteId),
      page,
      search,
      pageSize,
    ] as const,
};
