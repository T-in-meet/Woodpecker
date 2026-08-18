/**
 * 한 번의 Note Chat 검색에서 가져올 최대 Embedding chunk 후보 개수입니다.
 *
 * 청킹된 Note Embedding 전체를 대상으로 검색하며,
 * 같은 Note에 속한 여러 chunk가 후보에 함께 포함될 수 있습니다.
 *
 * 실제 Prompt Context에 포함할 chunk 개수와는 별도로 관리합니다.
 */
export const NOTE_CHAT_MATCH_LIMIT = 20;

/**
 * 한 번의 Note Chat 실행에서 Prompt Context에 포함할 최대 chunk 개수입니다.
 *
 * Embedding 검색 후보 중 검색 순위가 높은 chunk부터 사용하며,
 * 같은 Note에 속한 여러 chunk가 Context에 함께 포함될 수 있습니다.
 */
export const NOTE_CHAT_CONTEXT_LIMIT = 5;

/**
 * Note Chat의 Embedding chunk 검색 결과에 요구하는 최소 유사도입니다.
 *
 * 현재는 검색 결과를 유사도로 제외하지 않도록 0으로 설정합니다.
 * 검색 품질을 조정할 때 이 값을 높여 관련성이 낮은 chunk를 제외할 수 있습니다.
 */
export const NOTE_CHAT_MIN_SIMILARITY = 0;

/**
 * 한 번의 Note Chat 실행에서 Provider에 전달할
 * 이전 대화 메시지의 최대 개수입니다.
 */
export const NOTE_CHAT_HISTORY_MESSAGE_LIMIT = 10;

/**
 * 한 번의 Note Chat 실행에서 Provider에 전달할
 * 이전 대화 메시지 본문의 최대 문자 수입니다.
 *
 * 메시지 개수 제한을 적용한 뒤 최신 메시지부터 계산하여,
 * 이 값을 초과하는 오래된 메시지는 제외합니다.
 */
export const NOTE_CHAT_HISTORY_CHAR_LIMIT = 12000;

/**
 * 한 사용자가 하루 동안 실행할 수 있는 Note Chat AI 실행의 최대 횟수입니다.
 */
export const NOTE_CHAT_DAILY_EXECUTION_LIMIT = 10;

/**
 * Note Chat 일일 AI 실행 횟수 초과 오류 코드입니다.
 *
 * 일일 실행 제한 초과 시 Route가 클라이언트에 반환하며,
 * 클라이언트에서 제한 초과 상태를 식별하는 데 사용합니다.
 */
export const NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE =
  "DAILY_EXECUTION_LIMIT_EXCEEDED";

/**
 * Note Chat 일일 AI 실행 횟수 초과를 식별하는 PostgreSQL SQLSTATE입니다.
 *
 * 일일 실행 제한 RPC가 발생시킨 오류를 Supabase/PostgREST 응답의
 * code 필드로 판별하여 429 응답으로 변환하는 데 사용합니다.
 */
export const NOTE_CHAT_DAILY_EXECUTION_LIMIT_SQLSTATE = "WP002";
