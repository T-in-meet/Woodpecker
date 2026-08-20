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

  /** 확장된 검색 질의를 사용하여 관련 Note chunk를 검색합니다. */
  NOTE_RETRIEVAL: "note-retrieval",
} as const;

/**
 * Related Notes 벡터 검색에서 반환할 최대 Note chunk 개수입니다.
 */
export const RELATED_NOTES_SEARCH_LIMIT = 10;

/**
 * Related Notes 벡터 검색 결과에 허용할 최소 유사도입니다.
 */
export const RELATED_NOTES_MIN_SIMILARITY = 0;
