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

  /**
   * 실행 당시 검색된 Embedding 입력 Snapshot입니다.
   *
   * 기존 필드명과 저장 형식의 호환성을 유지하기 위해 `content`를 사용하지만,
   * 값은 Note 전체 본문이 아니라 ai_embeddings.input_text에 저장된
   * 실제 검색 chunk snapshot입니다.
   */
  content: string;

  /** Embedding 검색 거리입니다. */
  distance: number;

  /** 검색에 사용된 chunk Embedding ID입니다. */
  embeddingId: string;

  /** 검색된 chunk가 속한 실제 Note ID입니다. */
  noteId: string;

  /** Embedding 검색 유사도입니다. */
  similarity: number;

  /** Source 종류입니다. */
  type: "note";

  /**
   * 현재 Note 제목입니다.
   *
   * content에도 Embedding 생성 당시 제목 snapshot이 포함되지만,
   * UI나 후속 처리에서 Note metadata를 사용할 수 있도록 별도로 유지합니다.
   */
  title: string;
};

/**
 * Prompt Context에 사용된 Note chunk 목록을
 * Run에 저장할 Context Source Snapshot으로 변환합니다.
 *
 * 청킹 도입 이후 같은 Note에서 여러 chunk가 검색된 경우에도
 * 각각 별도 Source로 유지합니다.
 *
 * `contextIndex`는 buildNoteContext가 각 chunk에 부여하는 index와
 * 동일한 순서를 사용하므로, LLM이 참조한 Context 번호를
 * 정확한 Embedding chunk와 다시 연결할 수 있습니다.
 *
 * @param notes 실제 Prompt Context에 사용된 검색 Note chunk 목록
 * @returns AI Run Retrieval Snapshot과 응답 후처리에 사용할 JSON 목록
 */
export function buildNoteChatSources(notes: MatchedNote[]): Json[] {
  return notes.map((note, index) => ({
    contextIndex: index + 1,

    /*
     * Note의 현재 전체 본문이 아니라 검색된 Embedding의 input_text를 저장합니다.
     * 이를 통해 Run Source와 실제 LLM Context가 같은 snapshot을 가리킵니다.
     */
    content: note.chunkText,

    distance: note.distance,
    embeddingId: note.embeddingId,
    noteId: note.id,
    similarity: note.similarity,
    title: note.title,
    type: "note",
  }));
}
