/**
 * 선택된 후보를 전체 후보 배열의 index로 변환합니다.
 *
 * 후보는 embeddingId를 기준으로 대응시키며,
 * 선택된 후보 중 하나라도 전체 후보에서 찾을 수 없으면
 * 유효하지 않은 index를 만들지 않고 null을 반환합니다.
 */
export function resolveCandidateIndexes(
  candidates: Array<{ embeddingId: string }>,
  selectedCandidates: Array<{ embeddingId: string }>,
): number[] | null {
  const indexByEmbeddingId = new Map(
    candidates.map((candidate, index) => [candidate.embeddingId, index]),
  );

  const indexes = selectedCandidates.map((candidate) =>
    indexByEmbeddingId.get(candidate.embeddingId),
  );

  if (indexes.some((index) => index === undefined)) {
    return null;
  }

  return indexes as number[];
}
