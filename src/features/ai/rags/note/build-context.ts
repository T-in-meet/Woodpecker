import type { MatchedNote } from "./get-matched-notes";

type BuildNoteContextParams = {
  notes: MatchedNote[];
};

/**
 * 검색된 Note chunk를 LLM에 전달할 Context 문자열로 구성합니다.
 *
 * 청킹 도입 이후에는 Note 전체 본문이 아니라,
 * 실제 Embedding 검색에 사용된 chunk snapshot만 Context에 포함합니다.
 *
 * `chunkText`는 ai_embeddings.input_text에 저장된 값으로,
 * 해당 embedding vector를 생성할 때 사용한 제목 + chunk 본문 snapshot입니다.
 * 따라서 Note 수정 후 새 embedding generation 생성에 실패해
 * 기존 generation이 유지되는 경우에도,
 * 검색된 vector와 Context에 전달되는 텍스트가 같은 snapshot을 사용합니다.
 *
 * 검색 결과의 similarity, distance 등의 메타데이터는 LLM Context에서 제외하고,
 * 응답에서 참조할 수 있도록 1부터 시작하는 Context 번호만 함께 제공합니다.
 *
 * 같은 Note에서 여러 chunk가 검색된 경우에도 각각 독립된 Context 항목으로 유지합니다.
 *
 * @param params 검색된 Note chunk 목록
 * @returns LLM에 전달할 Note chunk Context
 */
export function buildNoteContext({ notes }: BuildNoteContextParams): string {
  return notes
    .map(
      (note, index) =>
        `<note>\n<index>[${index + 1}]</index>\n<chunk>${note.chunkText}</chunk>\n</note>`,
    )
    .join("\n\n");
}
