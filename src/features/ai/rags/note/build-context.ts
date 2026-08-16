import type { MatchedNote } from "./get-matched-notes";

type BuildNoteContextParams = {
  notes: MatchedNote[];
};

/**
 * 검색된 Note를 LLM에 전달할 Context 문자열로 구성합니다.
 *
 * 검색 결과의 similarity, distance 등의 메타데이터는 제외하고,
 * LLM이 응답에서 참조할 1부터 시작하는 Context 번호와 Note 제목·본문만
 * Context에 포함합니다.
 *
 * @param params 검색된 Note 목록
 * @returns LLM에 전달할 Note Context
 */
export function buildNoteContext({ notes }: BuildNoteContextParams): string {
  return notes
    .map(
      (note, index) =>
        `<note>\n<index>[${index + 1}]</index>\n<title>${note.title}</title>\n<content>${note.content}</content>\n</note>`,
    )
    .join("\n\n");
}
