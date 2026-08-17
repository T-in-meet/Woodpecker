import {
  type AiEmbeddingTokenizer,
  createDefaultAiEmbeddingTokenizer,
} from "@/features/ai/embeddings/tokenizer";

import {
  DEFAULT_NOTE_CHUNK_TOKEN_LIMIT,
  DEFAULT_NOTE_CHUNK_TOKEN_OVERLAP,
} from "./constants/chunk";

export type NoteChunkPolicy = {
  /** 한 chunk에 포함할 최대 token 수입니다. */
  chunkTokenLimit: number;

  /** 인접 chunk 사이에 중복으로 포함할 token 수입니다. */
  overlapTokens: number;
};

type CreateNoteContentChunksParams = {
  content: string;

  /**
   * 청킹 정책입니다.
   *
   * 향후 Provider/Model별 입력 한도에 맞는 정책을 전달할 수 있습니다.
   */
  policy?: NoteChunkPolicy | undefined;

  /**
   * token encode/decode 구현입니다.
   *
   * 향후 Provider/Model별 tokenizer를 주입할 수 있습니다.
   */
  tokenizer?: AiEmbeddingTokenizer | undefined;
};

/**
 * Note 본문을 token 기준으로 겹치는 chunk 목록으로 분할합니다.
 *
 * 현재는 공통 tokenizer와 보수적인 기본 chunk 정책을 사용하지만,
 * tokenizer와 policy를 외부에서 주입할 수 있어 Provider/Model별 정책으로
 * 확장할 수 있습니다.
 *
 * @param params Note 본문과 선택적인 tokenizer/chunk 정책입니다.
 * @returns 원문 순서를 유지하는 Note 본문 chunk 목록입니다.
 */
export function createNoteContentChunks({
  content,
  policy = {
    chunkTokenLimit: DEFAULT_NOTE_CHUNK_TOKEN_LIMIT,
    overlapTokens: DEFAULT_NOTE_CHUNK_TOKEN_OVERLAP,
  },
  tokenizer = createDefaultAiEmbeddingTokenizer(),
}: CreateNoteContentChunksParams): string[] {
  if (policy.chunkTokenLimit <= 0) {
    throw new Error("Note chunk token limit must be greater than 0.");
  }

  if (policy.overlapTokens < 0) {
    throw new Error("Note chunk overlap must not be negative.");
  }

  if (policy.overlapTokens >= policy.chunkTokenLimit) {
    throw new Error(
      "Note chunk overlap must be smaller than the chunk token limit.",
    );
  }

  const tokens = tokenizer.encode(content);

  if (tokens.length === 0) {
    return [];
  }

  if (tokens.length <= policy.chunkTokenLimit) {
    return [content];
  }

  const chunks: string[] = [];
  const step = policy.chunkTokenLimit - policy.overlapTokens;

  for (let start = 0; start < tokens.length; start += step) {
    const end = Math.min(start + policy.chunkTokenLimit, tokens.length);
    const chunkTokens = tokens.slice(start, end);

    chunks.push(tokenizer.decode(chunkTokens));

    if (end === tokens.length) {
      break;
    }
  }

  return chunks;
}
