import { z } from "zod";

import type { AiEmbeddingMatchRow } from "@/features/ai/embeddings/types";
import {
  NOTE_CHAT_OPERATIONAL_ERROR_CODES,
  NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS,
  NOTE_CHAT_OPERATIONAL_ERROR_STAGES,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { reportNoteChatOperationalError } from "../utils/report-operational-error";

/**
 * 노트 챗봇 Context 생성에 사용하는 검색된 노트입니다.
 */
export type NoteChatMatchedNote = {
  /** Embedding 검색 거리입니다. */
  distance: number;

  /** 검색된 Embedding ID입니다. */
  embeddingId: string;

  /** 노트 ID입니다. */
  id: string;

  /** Embedding 검색 유사도입니다. */
  similarity: number;

  /** 노트 본문입니다. */
  content: string;

  /** 노트 제목입니다. */
  title: string;
};

const noteChatMatchedNoteRowSchema = z.object({
  content: z.string(),
  id: z.string().uuid(),
  title: z.string(),
});

type GetMatchedNoteChatNotesParams = {
  /** Embedding 검색 결과입니다. */
  matches: AiEmbeddingMatchRow[];

  /** 검색 대상 노트의 소유 사용자 ID입니다. */
  ownerUserId: string;
};

/**
 * Embedding 검색 결과에 해당하는 실제 노트를 조회합니다.
 *
 * 검색 결과의 `source_id`를 Note ID로 사용하며,
 * 현재 사용자가 소유한 노트만 조회합니다.
 *
 * DB 조회 결과의 순서와 관계없이 Embedding 검색 결과 순서를 유지하여
 * 유사도가 높은 노트부터 반환합니다.
 *
 * @param params Embedding 검색 결과와 노트 소유 사용자 ID
 * @returns Embedding 검색 정보와 실제 노트가 결합된 목록
 */
export async function getMatchedNoteChatNotes({
  matches,
  ownerUserId,
}: GetMatchedNoteChatNotesParams): Promise<NoteChatMatchedNote[]> {
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
    /*
     * Embedding 검색 자체는 완료되었지만 실제 Note 조회가 실패한 경우이므로
     * 검색 결과나 노트 본문은 기록하지 않고 사용자와 DB 오류만 보고합니다.
     */
    await reportNoteChatOperationalError({
      actorUserId: ownerUserId,
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.MATCHED_NOTES_LOAD_FAILED,
      message: "노트 챗봇 검색 노트 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_MATCHED_NOTES,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
      userId: ownerUserId,
    });

    throw new Error(`Failed to get matched note chat notes: ${error.message}`);
  }

  const notes = z.array(noteChatMatchedNoteRowSchema).parse(data ?? []);
  const notesById = new Map(notes.map((note) => [note.id, note]));

  /*
   * Supabase의 IN 조회는 입력 ID 순서를 보장하지 않으므로
   * Embedding 검색 결과를 기준으로 다시 조합합니다.
   *
   * 삭제되었거나 사용자 소유가 아닌 노트는 조회 결과에 존재하지 않으므로
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
