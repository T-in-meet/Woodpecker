import type { MatchedNote } from "@/features/ai/rags/note/get-matched-notes";

type BuildRelatedNoteContextParams = {
  notes: MatchedNote[];
};

/**
 * 검색된 Note chunk를 Related Notes Answer Agent에 전달할 Context 문자열로 구성합니다.
 *
 * 공통 Note RAG Context와 달리 Related Notes 추천 결과에서는
 * LLM이 선택한 Note를 식별할 수 있어야 하므로 각 chunk에 Note ID를 함께 제공합니다.
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
 * 같은 Note에서 여러 chunk가 검색된 경우에는 동일한 Note ID를 가진
 * 여러 Context 항목으로 유지합니다.
 * 최종 추천 응답에서는 Answer Agent가 동일한 Note ID를 한 번만 선택하도록 하고,
 * 서버에서도 반환된 Note ID를 다시 검증합니다.
 *
 * 검색 결과의 similarity, distance 등의 메타데이터는
 * Related Notes Answer Agent의 판단에 필요하지 않으므로 Context에서 제외합니다.
 *
 * @param params 검색된 Note chunk 목록
 * @returns Related Notes Answer Agent에 전달할 Note chunk Context
 */
export function buildRelatedNoteContext({
  notes,
}: BuildRelatedNoteContextParams): string {
  return notes
    .map(
      (note) =>
        `<note>\n<note_id>${note.id}</note_id>\n<chunk>${note.chunkText}</chunk>\n</note>`,
    )
    .join("\n\n");
}
