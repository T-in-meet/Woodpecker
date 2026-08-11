import { AI_EMBEDDING_INPUT_PREVIEW_MAX_LENGTH } from "@/features/ai/constants/embeddings";
import { deleteAiEmbeddingsBySource } from "@/features/ai/embeddings/cache";
import { generateAiEmbedding } from "@/features/ai/embeddings/generate";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";
import {
  NOTE_EMBEDDING_INPUT_KIND,
  NOTE_EMBEDDING_SOURCE_TYPE,
} from "@/features/note-chats/constants/embeddings";

/**
 * Note 내용을 RAG embedding에 사용할 입력 텍스트로 변환합니다.
 *
 * 기존 Note RAG embedding과 동일한 입력 형식을 유지하여
 * 기존 embedding과 새로 생성되는 embedding의 검색 기준을 일치시킵니다.
 *
 * @param title Note 제목입니다.
 * @param content Note 내용입니다.
 * @returns RAG embedding에 사용할 입력 텍스트입니다.
 */
export function createNoteEmbeddingInput(
  title: string,
  content: string,
): string {
  return `Title:
${title}

Content:
${content}`;
}

/**
 * Note의 현재 제목과 내용을 embedding으로 저장합니다.
 *
 * 새 embedding을 먼저 저장한 후 기존 Note embedding을 정리하여,
 * embedding 생성 실패 시 기존 검색 데이터를 유지할 수 있도록 합니다.
 *
 * @param params Note embedding 생성에 필요한 정보입니다.
 * @returns 새로 저장된 AI embedding입니다.
 */
export async function generateNoteEmbedding({
  embeddingConfiguration,
  ownerUserId,
  noteId,
  title,
  content,
}: {
  embeddingConfiguration: AiRuntimeEmbeddingConfiguration;
  ownerUserId: string;
  noteId: string;
  title: string;
  content: string;
}) {
  const inputText = createNoteEmbeddingInput(title, content);

  const embedding = await generateAiEmbedding({
    embeddingConfiguration,
    ownerUserId,
    sourceType: NOTE_EMBEDDING_SOURCE_TYPE,
    sourceId: noteId,
    inputKind: NOTE_EMBEDDING_INPUT_KIND,
    inputText,
    inputPreview: inputText.slice(0, AI_EMBEDDING_INPUT_PREVIEW_MAX_LENGTH),
  });

  await deleteAiEmbeddingsBySource({
    ownerUserId,
    sourceType: NOTE_EMBEDDING_SOURCE_TYPE,
    sourceId: noteId,
    inputKind: NOTE_EMBEDDING_INPUT_KIND,
    excludeEmbeddingId: embedding.id,
  });

  return embedding;
}
