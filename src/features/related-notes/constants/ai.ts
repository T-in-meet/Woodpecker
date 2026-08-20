/**
 * Related Notes AI Runtime Configuration을 식별하는 Feature Key입니다.
 */
export const RELATED_NOTES_AI_FEATURE_KEY = "related-notes";

/**
 * Related Notes AI 실행에서 사용하는 Runtime Role Key입니다.
 */
export const RELATED_NOTES_AI_ROLE_KEY = {
  /** 검색된 Note Context를 기반으로 최종 관련 노트를 선택합니다. */
  ANSWER_GENERATION: "answer-generation",

  /** Note의 제목과 내용을 관련 노트 검색 질의로 확장합니다. */
  QUERY_EXPANSION: "query-expansion",
} as const;

/**
 * Related Notes 검색에서 가져올 최대 Note chunk 수입니다.
 *
 * 현재는 Note 단위 후보 수를 보장하지 않고, 질문과 가장 관련성이 높은
 * chunk 자체를 우선하여 Answer Agent Context에 전달합니다.
 *
 * 따라서 동일 Note의 여러 chunk가 상위 결과를 차지할 수 있으며,
 * 실제 후보 Note 수는 이 값보다 적을 수 있습니다.
 *
 * 이는 하나의 Note에 여러 관련 근거가 있는 경우 해당 정보를 함께
 * 활용하기 위한 현재 검색 정책입니다.
 *
 * 추천 품질 평가에서 특정 Note의 chunk 편중이 문제가 될 경우,
 * Note 단위 grouping, diversity penalty/MMR, 2단계 retrieval 등의
 * 방식으로 후보 다양성을 개선하는 방향을 별도로 검토합니다.
 */
export const RELATED_NOTES_SEARCH_LIMIT = 10;

/**
 * Related Notes 벡터 검색 결과에 허용할 최소 유사도입니다.
 */
export const RELATED_NOTES_MIN_SIMILARITY = 0;
