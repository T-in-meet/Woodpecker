import { z } from "zod";

import type { AiEmbeddingMatchRow } from "@/features/ai/embeddings/types";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Note RAG에서 Embedding 검색 결과와 결합된 Note입니다.
 */
export type MatchedNote = {
  /** Embedding 검색 거리입니다. */
  distance: number;

  /** 검색된 Embedding ID입니다. */
  embeddingId: string;

  /** Note ID입니다. */
  id: string;

  /** Embedding 검색 유사도입니다. */
  similarity: number;

  /** Note 본문입니다. */
  content: string;

  /** Note 제목입니다. */
  title: string;
};

const matchedNoteRowSchema = z.object({
  content: z.string(),
  id: z.string().uuid(),
  title: z.string(),
});

type GetMatchedNotesParams = {
  /** Embedding 검색 결과입니다. */
  matches: AiEmbeddingMatchRow[];

  /** 검색 대상 Note의 소유 사용자 ID입니다. */
  ownerUserId: string;
};

/**
 * Embedding 검색 결과에 해당하는 실제 Note를 조회합니다.
 *
 * 검색 결과의 `source_id`를 Note ID로 사용하며,
 * 현재 사용자가 소유한 Note만 조회합니다.
 *
 * DB 조회 결과의 순서와 관계없이 Embedding 검색 결과 순서를 유지하여
 * 유사도가 높은 Note부터 반환합니다.
 *
 * @param params Embedding 검색 결과와 Note 소유 사용자 ID
 * @returns Embedding 검색 정보와 실제 Note가 결합된 목록
 */
export async function getMatchedNotes({
  matches,
  ownerUserId,
}: GetMatchedNotesParams): Promise<MatchedNote[]> {
  if (matches.length === 0) {
    return [];
  }

  const noteIds = matches.map((match) => match.source_id);
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("notes")
    .select("id, title, content")
    .eq("user_id", ownerUserId)
    .in("id", noteIds);

  if (error) {
    throw new Error(`Failed to get matched notes: ${error.message}`);
  }

  const notes = z.array(matchedNoteRowSchema).parse(data ?? []);
  const notesById = new Map(notes.map((note) => [note.id, note]));

  /*
   * Supabase의 IN 조회는 입력 ID 순서를 보장하지 않으므로
   * Embedding 검색 결과를 기준으로 다시 조합합니다.
   *
   * 삭제되었거나 사용자 소유가 아닌 Note는 조회 결과에 존재하지 않으므로
   * Context 대상에서 제외합니다.
   */
  return matches.flatMap((match) => {
    const note = notesById.get(match.source_id);

    if (!note) {
      return [];
    }

    return [
      {
        content: note.content,
        distance: match.distance,
        embeddingId: match.embedding_id,
        id: note.id,
        similarity: match.similarity,
        title: note.title,
      },
    ];
  });
}
