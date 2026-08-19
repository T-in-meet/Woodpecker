import { getEncoding } from "js-tiktoken";

/**
 * Embedding 입력 청킹에서 사용하는 공통 tokenizer 인터페이스입니다.
 *
 * 현재는 공통 tokenizer를 사용하지만,
 * 향후 Provider/Model별 tokenizer 구현으로 교체할 수 있습니다.
 */
export type AiEmbeddingTokenizer = {
  decode(tokens: number[]): string;
  encode(text: string): number[];
};

/**
 * 현재 공통 embedding 청킹에 사용하는 tokenizer입니다.
 *
 * 특정 Runtime Model에 종속되지 않도록 청킹 계층에서는
 * AiEmbeddingTokenizer 인터페이스만 사용합니다.
 *
 * 향후 Provider/Model별 tokenizer가 필요해지면
 * 이 구현을 교체하거나 별도 resolver를 추가할 수 있습니다.
 */
export function createDefaultAiEmbeddingTokenizer(): AiEmbeddingTokenizer {
  const encoding = getEncoding("cl100k_base");

  return {
    decode(tokens) {
      return encoding.decode(tokens);
    },

    encode(text) {
      return encoding.encode(text);
    },
  };
}
