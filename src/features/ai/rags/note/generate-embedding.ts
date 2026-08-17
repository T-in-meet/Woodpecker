import { randomUUID } from "node:crypto";

import { AI_EMBEDDING_INPUT_PREVIEW_MAX_LENGTH } from "@/features/ai/constants/embeddings";
import { deleteInactiveAiEmbeddingGeneration } from "@/features/ai/embeddings/cache";
import { generateAiEmbedding } from "@/features/ai/embeddings/generate";
import { activateAiEmbeddingGeneration } from "@/features/ai/embeddings/generation";
import { createAiSha256Hash } from "@/features/ai/embeddings/hash";
import {
  NOTE_EMBEDDING_INPUT_KIND,
  NOTE_EMBEDDING_SOURCE_TYPE,
} from "@/features/ai/rags/note/constants/embeddings";
import type { AiRuntimeEmbeddingConfiguration } from "@/features/ai/runtimes/types";

import { createNoteContentChunks } from "./chunk";

/**
 * Note 내용을 RAG embedding에 사용할 입력 텍스트로 변환합니다.
 *
 * 각 chunk에도 Note 제목을 함께 포함하여,
 * 본문 일부만 분할되더라도 Note 제목의 의미를 검색 신호로 유지합니다.
 *
 * @param title Note 제목입니다.
 * @param content Note 전체 내용 또는 현재 chunk 내용입니다.
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
 * Note의 현재 제목과 내용을 chunk 단위 embedding generation으로 저장합니다.
 *
 * 새 generation의 모든 chunk embedding을 먼저 생성한 뒤,
 * 전체 generation이 완성되고 작업 시작 시점의 Note version이 여전히 최신인 경우에만
 * 활성 generation으로 전환합니다.
 *
 * chunk 생성 또는 embedding 생성/저장/활성화 중 하나라도 실패하면
 * 현재 generation이 active가 아닌 경우에만 해당 row를 정리하고
 * 기존 활성 generation은 유지합니다.
 *
 * 기존 활성 generation을 유지하는 것은 일시적인 embedding 실패로 인해
 * 해당 Note가 RAG 검색에서 완전히 제외되는 것을 방지하기 위한 정책입니다.
 * 따라서 Note 수정 후 재임베딩에 실패한 경우에는 새 generation이 성공적으로
 * 활성화될 때까지 이전 Note 내용의 embedding과 input snapshot이
 * 검색 및 Context에 사용될 수 있습니다.
 *
 * @param params Note embedding 생성에 필요한 정보입니다.
 * @returns 새로 활성화된 generation의 embedding row 목록입니다.
 */
export async function generateNoteEmbedding({
  embeddingConfiguration,
  ownerUserId,
  noteId,
  sourceUpdatedAt,
  title,
  content,
}: {
  embeddingConfiguration: AiRuntimeEmbeddingConfiguration;
  ownerUserId: string;
  noteId: string;
  sourceUpdatedAt: string;
  title: string;
  content: string;
}) {
  const generationId = randomUUID();

  /*
   * contentHash는 개별 chunk가 아니라 이번 generation의 원본 Note 버전을
   * 식별합니다. 같은 Note 버전에서 생성된 모든 chunk는 동일한 contentHash를
   * 공유하고, 각 chunk의 실제 Provider 입력은 generateAiEmbedding에서
   * 별도의 inputHash로 계산합니다.
   */
  const contentHash = createAiSha256Hash(
    createNoteEmbeddingInput(title, content),
  );

  const chunks = createNoteContentChunks({ content });
  const chunkCount = chunks.length;
  const embeddings = [];

  try {
    /*
     * 새 generation의 chunk는 순차적으로 생성합니다.
     *
     * Promise.all로 병렬 처리하면 한 chunk 실패 후 generation cleanup이
     * 실행되는 동안 아직 완료되지 않은 다른 chunk가 뒤늦게 INSERT되어
     * 실패한 generation row가 다시 남을 수 있으므로 사용하지 않습니다.
     */
    for (const [chunkIndex, chunkContent] of chunks.entries()) {
      const inputText = createNoteEmbeddingInput(title, chunkContent);

      const embedding = await generateAiEmbedding({
        chunkCount,
        chunkIndex,
        contentHash,
        embeddingConfiguration,
        generationId,
        inputKind: NOTE_EMBEDDING_INPUT_KIND,
        inputPreview: inputText.slice(0, AI_EMBEDDING_INPUT_PREVIEW_MAX_LENGTH),
        inputText,
        ownerUserId,
        sourceId: noteId,
        sourceType: NOTE_EMBEDDING_SOURCE_TYPE,
      });

      embeddings.push(embedding);
    }

    /*
     * 모든 chunk가 정상적으로 저장된 뒤에만 새 generation을 활성화합니다.
     *
     * DB RPC가 chunk_count와 chunk_index 연속성을 다시 검증하고,
     * sourceUpdatedAt과 현재 Note의 updated_at도 비교하여
     * 오래된 Note 내용으로 생성된 generation의 활성화를 거부합니다.
     *
     * 활성화 성공 후 직전 활성 generation은 transaction 안에서 정리됩니다.
     */
    await activateAiEmbeddingGeneration({
      generationId,
      inputKind: NOTE_EMBEDDING_INPUT_KIND,
      modelConfigId: embeddingConfiguration.model.id,
      ownerUserId,
      sourceId: noteId,
      sourceType: NOTE_EMBEDDING_SOURCE_TYPE,
      sourceUpdatedAt,
    });

    return embeddings;
  } catch (error) {
    /*
     * 새 generation 생성이 일부만 성공했거나 활성화 호출이 실패한 경우
     * 현재 generation이 active가 아닐 때만 해당 row를 정리합니다.
     *
     * activation이 DB에서는 성공했지만 호출자에게 실패로 전달된 경우에도
     * 이미 active가 된 generation은 cleanup RPC가 삭제하지 않습니다.
     */
    try {
      await deleteInactiveAiEmbeddingGeneration({
        generationId,
        inputKind: NOTE_EMBEDDING_INPUT_KIND,
        modelConfigId: embeddingConfiguration.model.id,
        ownerUserId,
        sourceId: noteId,
        sourceType: NOTE_EMBEDDING_SOURCE_TYPE,
      });
    } catch {
      /*
       * generation cleanup 실패는 deleteInactiveAiEmbeddingGeneration 내부에서
       * operational error로 이미 보고됩니다.
       *
       * cleanup 오류로 원래 embedding/activation 오류를 덮어쓰지 않습니다.
       */
    }

    throw error;
  }
}
