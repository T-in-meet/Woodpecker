/**
 * Note RAG retrieval에 사용할 canonical AI Setting feature key입니다.
 *
 * 현재 DB의 canonical runtime은 기존 `note-chat / note-retrieval` 설정입니다.
 * Note embedding 생성, Note Chat 검색, Related Notes 검색은 모두 이 runtime을
 * 사용해야 저장된 Note chunk embedding과 검색 질의 embedding의 model_config_id가
 * 동일하게 유지됩니다.
 */
export const NOTE_RETRIEVAL_AI_FEATURE_KEY = "note-chat";

/**
 * Note RAG retrieval에 사용할 canonical AI Setting role key입니다.
 *
 * 이 role은 Prompt 없이 Embedding Model만 지정하며, Note RAG의 저장·검색 경로가
 * 같은 vector space를 사용하도록 보장하는 단일 조회 지점입니다.
 */
export const NOTE_RETRIEVAL_AI_ROLE_KEY = "note-retrieval";
