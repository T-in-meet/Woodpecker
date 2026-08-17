import { z } from "zod";

import type { AiEmbeddingMatchRow } from "@/features/ai/embeddings/types";
import {
  NOTE_EMBEDDING_INPUT_KIND,
  NOTE_EMBEDDING_SOURCE_TYPE,
} from "@/features/ai/rags/note/constants/embeddings";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Note RAG에서 Embedding 검색 결과와 결합된 Note chunk입니다.
 *
 * 청킹 도입 이후 하나의 Note에서 여러 chunk가 검색 결과에 포함될 수 있으므로,
 * 이 타입의 한 항목은 "Note 한 개"가 아니라 "검색된 Note chunk 한 개"를 의미합니다.
 */
export type MatchedNote = {
  /** 검색된 chunk의 Embedding 검색 거리입니다. */
  distance: number;

  /** 검색된 chunk의 Embedding ID입니다. */
  embeddingId: string;

  /** 원본 Note ID입니다. */
  id: string;

  /** Embedding 검색 유사도입니다. */
  similarity: number;

  /**
   * 검색에 실제로 사용된 Embedding 입력 snapshot입니다.
   *
   * Note의 현재 content를 다시 조회하지 않고 ai_embeddings.input_text를 사용하여,
   * 검색된 vector와 LLM Context에 전달되는 텍스트가 같은 generation의
   * snapshot을 가리키도록 합니다.
   *
   * Note 수정 후 새 embedding generation 생성에 실패해 기존 generation이
   * 유지되는 경우에도, 새 Note 본문과 이전 embedding이 섞이는 것을 방지합니다.
   */
  chunkText: string;

  /**
   * 현재 Note 제목입니다.
   *
   * chunkText 안에도 embedding 생성 당시 제목 snapshot이 포함될 수 있지만,
   * Note 식별이나 관련 노트 기능 등 현재 Note metadata가 필요한 호출 계층을 위해
   * 별도로 유지합니다.
   */
  title: string;
};

/**
 * 현재 존재하며 사용자가 소유한 Note인지 확인하기 위한 조회 행입니다.
 */
const matchedNoteRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
});

/**
 * 검색 결과에 대응하는 Embedding chunk snapshot 조회 행입니다.
 */
const matchedEmbeddingRowSchema = z.object({
  id: z.string().uuid(),
  input_text: z.string().min(1),
  source_id: z.string().uuid(),
});

type GetMatchedNotesParams = {
  /** chunk 단위 Embedding 검색 결과입니다. */
  matches: AiEmbeddingMatchRow[];

  /** 검색 대상 Note의 소유 사용자 ID입니다. */
  ownerUserId: string;
};

/**
 * Embedding 검색 결과에 실제 Note와 검색된 chunk snapshot을 결합합니다.
 *
 * 청킹 이전에는 `source_id`로 Note 전체 본문을 조회해 Context에 사용했지만,
 * 청킹 이후에는 `embedding_id`에 해당하는 `ai_embeddings.input_text`를 사용합니다.
 *
 * 이를 통해:
 * - 검색된 chunk만 LLM Context에 전달하고
 * - 같은 Note의 여러 chunk를 각각 유지하며
 * - 검색 vector와 Context text가 같은 generation snapshot을 사용하도록 합니다.
 *
 * Note 조회는 현재 Note의 존재 여부와 사용자 소유권을 확인하기 위해 수행합니다.
 * 삭제되었거나 다른 사용자의 Note는 결과에서 제외합니다.
 *
 * @param params Embedding 검색 결과와 Note 소유 사용자 ID
 * @returns 검색 순서를 유지한 Note chunk 목록
 */
export async function getMatchedNotes({
  matches,
  ownerUserId,
}: GetMatchedNotesParams): Promise<MatchedNote[]> {
  if (matches.length === 0) {
    return [];
  }

  const supabase = createAdminClient();

  /*
   * 하나의 Note에서 여러 chunk가 검색될 수 있으므로 source_id와 embedding_id에
   * 중복이 있을 수 있습니다. DB의 IN 조건에는 중복 제거된 ID만 전달합니다.
   */
  const noteIds = [...new Set(matches.map((match) => match.source_id))];
  const embeddingIds = [...new Set(matches.map((match) => match.embedding_id))];

  /*
   * Note 조회와 Embedding snapshot 조회는 서로 FK 관계가 없는 별도 테이블이므로
   * 병렬로 조회합니다.
   *
   * notes:
   *   현재 Note가 존재하고 해당 사용자의 소유인지 확인합니다.
   *
   * ai_embeddings:
   *   실제 검색된 embedding_id의 input_text snapshot을 조회합니다.
   */
  const [notesResult, embeddingsResult] = await Promise.all([
    supabase
      .from("notes")
      .select("id, title")
      .eq("user_id", ownerUserId)
      .in("id", noteIds),

    supabase
      .from("ai_embeddings")
      .select("id, source_id, input_text")
      .eq("owner_user_id", ownerUserId)
      .eq("source_type", NOTE_EMBEDDING_SOURCE_TYPE)
      .eq("input_kind", NOTE_EMBEDDING_INPUT_KIND)
      .in("id", embeddingIds),
  ]);

  if (notesResult.error) {
    throw new Error(
      `Failed to get matched notes: ${notesResult.error.message}`,
    );
  }

  if (embeddingsResult.error) {
    throw new Error(
      `Failed to get matched note embeddings: ${embeddingsResult.error.message}`,
    );
  }

  const notes = z.array(matchedNoteRowSchema).parse(notesResult.data ?? []);
  const embeddings = z
    .array(matchedEmbeddingRowSchema)
    .parse(embeddingsResult.data ?? []);

  const notesById = new Map(notes.map((note) => [note.id, note]));
  const embeddingsById = new Map(
    embeddings.map((embedding) => [embedding.id, embedding]),
  );

  /*
   * Supabase의 IN 조회는 입력 순서를 보장하지 않으므로
   * 원래 Embedding 검색 결과 순서를 기준으로 다시 조합합니다.
   *
   * 같은 Note에서 여러 chunk가 검색된 경우에도 각각 독립된 결과로 유지합니다.
   */
  return matches.flatMap((match) => {
    const note = notesById.get(match.source_id);
    const embedding = embeddingsById.get(match.embedding_id);

    /*
     * Note가 삭제되었거나 사용자 소유가 아니면 제외합니다.
     * 검색된 embedding snapshot을 찾지 못한 경우도 Context에 사용할 수 없으므로
     * 해당 검색 결과를 제외합니다.
     */
    if (!note || !embedding) {
      return [];
    }

    /*
     * embedding_id가 가리키는 row의 source_id가 검색 결과 source_id와
     * 실제로 일치하는지 한 번 더 확인합니다.
     *
     * 정상적인 match_ai_embeddings 결과에서는 항상 같아야 하지만,
     * 서로 다른 source의 embedding snapshot이 잘못 결합되는 것을 방지합니다.
     */
    if (embedding.source_id !== match.source_id) {
      return [];
    }

    return [
      {
        chunkText: embedding.input_text,
        distance: match.distance,
        embeddingId: match.embedding_id,
        id: note.id,
        similarity: match.similarity,
        title: note.title,
      },
    ];
  });
}
