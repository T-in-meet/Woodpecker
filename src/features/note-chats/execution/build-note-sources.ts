import type { Json } from "@/types/db.helpers";

import type { NoteChatMatchedNote } from "./get-matched-notes";

/**
 * 노트 챗봇 실행에서 사용한 Note Context Source입니다.
 *
 * 노트가 이후 수정되더라도 실행 당시 실제로 사용한 Context를
 * 확인할 수 있도록 제목과 본문을 Snapshot으로 함께 저장합니다.
 */
export type NoteChatNoteSource = {
  /** LLM Context에서 이 노트를 식별하는 1부터 시작하는 순번입니다. */
  contextIndex: number;

  /** 실행 당시 노트 본문 Snapshot입니다. */
  content: string;

  /** Embedding 검색 거리입니다. */
  distance: number;

  /** 검색에 사용된 Embedding ID입니다. */
  embeddingId: string;

  /** 노트 ID입니다. */
  noteId: string;

  /** Embedding 검색 유사도입니다. */
  similarity: number;

  /** Source 종류입니다. */
  type: "note";

  /** 실행 당시 노트 제목 Snapshot입니다. */
  title: string;
};

/**
 * 검색된 노트 목록을 Run에 저장할 Context Source Snapshot으로 변환합니다.
 *
 * `contextIndex`는 Prompt Context의 note index와 동일하게 1부터 시작하며,
 * 이후 LLM이 반환한 참고 노트 순번을 실제 Note ID로 변환할 때 사용합니다.
 *
 * @param notes 실제 Prompt Context에 사용된 검색 노트 목록
 * @returns note_chat_runs.sources에 저장할 JSON 목록
 */
export function buildNoteChatSources(notes: NoteChatMatchedNote[]): Json[] {
  return notes.map((note, index) => ({
    contextIndex: index + 1,
    content: note.content,
    distance: note.distance,
    embeddingId: note.embeddingId,
    noteId: note.id,
    similarity: note.similarity,
    title: note.title,
    type: "note",
  }));
}
