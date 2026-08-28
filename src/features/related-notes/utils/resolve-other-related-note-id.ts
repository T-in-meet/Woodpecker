/** Related Note 관계 row에서 양쪽 Note ID만 사용하는 최소 형태입니다. */
export type RelatedNotePair = {
  /** 저장 row의 기준 Note ID입니다. */
  note_id: string;

  /** 저장 row의 반대편 Related Note ID입니다. */
  related_note_id: string;
};

/**
 * 양방향 Related Note 관계 row에서 현재 Note의 반대편 Note ID를 반환합니다.
 *
 * Related Notes는 하나의 저장 row를 양쪽 Note 화면에서 모두 표시하므로,
 * 호출자는 저장 방향을 직접 해석하지 않고 이 helper를 통해 반대편 ID를 얻습니다.
 *
 * @param relation 해석할 Related Note 관계 row
 * @param currentNoteId 화면 또는 실행 기준이 되는 현재 Note ID
 * @returns currentNoteId의 반대편 Note ID
 */
export function resolveOtherRelatedNoteId(
  relation: RelatedNotePair,
  currentNoteId: string,
): string {
  return relation.note_id === currentNoteId
    ? relation.related_note_id
    : relation.note_id;
}
