import type { MatchedNote } from "@/features/ai/rags/note/get-matched-notes";
import type { Json } from "@/types/db.helpers";

/**
 * 노트 챗봇 실행에서 LLM Context로 사용한 Note chunk Source입니다.
 *
 * 청킹 도입 이후 Source 한 항목은 Note 전체가 아니라
 * 실제 Prompt Context에 포함된 검색 chunk 한 개를 나타냅니다.
 */
export type NoteChatNoteSource = {
  /** LLM Context에서 chunk를 식별하는 1부터 시작하는 순번입니다. */
  contextIndex: number;

  /** 검색된 chunk가 속한 실제 Note ID입니다. */
  noteId: string;

  /** Source 종류입니다. */
  type: "note";
};

/**
 * Prompt Context에 사용된 Note chunk 목록을
 * 응답 후처리에 사용할 Context Source 목록으로 변환합니다.
 *
 * 청킹 도입 이후 같은 Note에서 여러 chunk가 검색된 경우에도
 * 각각 별도 Source로 유지합니다.
 *
 * `contextIndex`는 buildNoteContext가 각 chunk에 부여하는 index와
 * 동일한 순서를 사용하므로, LLM이 참조한 Context 번호를
 * 실제 Note ID로 변환할 수 있습니다.
 *
 * @param notes 실제 Prompt Context에 사용된 검색 Note chunk 목록
 * @returns Context index와 Note ID를 매핑한 JSON 목록
 */
export function buildNoteChatSources(notes: MatchedNote[]): Json[] {
  return notes.map((note, index) => ({
    contextIndex: index + 1,
    noteId: note.id,
    type: "note",
  }));
}
