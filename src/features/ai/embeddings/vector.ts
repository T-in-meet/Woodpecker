import { AI_EMBEDDING_DIMENSIONS } from "../constants/embeddings";

/**
 * 숫자 배열을 Supabase에서 pgvector 컬럼에 전달할 vector literal로 변환합니다.
 *
 * 현재 AI Foundation v1에서는 embedding dimension을 전역 상수로 고정하므로
 * 정확한 차원 수와 모든 원소의 유한 숫자 여부를 검증한 뒤 문자열로 직렬화합니다.
 *
 * @param vector pgvector 형식으로 변환할 embedding 벡터입니다.
 * @returns `[value1,value2,...]` 형식의 pgvector literal 문자열입니다.
 * @throws 벡터 차원이 현재 지원하는 dimension과 다르거나 유한하지 않은 숫자가 포함된 경우 오류를 발생시킵니다.
 */
export function formatAiVectorLiteral(vector: readonly number[]): string {
  /*
   * TODO(#285-follow-up):
   * 현재 v1에서는 DB vector 컬럼과 AI_EMBEDDING_DIMENSIONS가 1536으로 고정되어 있다.
   * 향후 model config별 embedding dimension을 지원할 경우 전역 상수를 참조하지 말고,
   * 호출 계층에서 해당 model config의 dimensions를 전달받아 검증하도록 변경해야 한다.
   */
  if (vector.length !== AI_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `AI vector must contain exactly ${AI_EMBEDDING_DIMENSIONS} dimensions.`,
    );
  }

  if (!vector.every((value) => Number.isFinite(value))) {
    throw new Error("AI vector must contain only finite numbers.");
  }

  return `[${vector.join(",")}]`;
}
