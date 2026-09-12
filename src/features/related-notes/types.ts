import type { Json } from "@/types/db.helpers";

/**
 * DB에 저장할 AI 관련 노트 추천 결과입니다.
 *
 * Related Notes 관계 row에는 Related Note title을 저장하지 않습니다.
 * title은 화면 조회 시 related_note_id로 notes.title을 다시 읽어 사용합니다.
 */
export type StoredRelatedNoteAiRecommendation = {
  /** 추천된 Note ID입니다. */
  noteId: string;

  /** AI가 이 Note를 관련 노트로 추천한 이유입니다. */
  reason: string;
} & Record<string, Json | undefined>;

/**
 * AI Answer/Verifier 실행 중 사용하는 관련 노트 추천 결과입니다.
 *
 * title은 LLM 검증과 실행 중 정규화에 필요한 현재 Note metadata이며,
 * 최종 DB 관계 metadata에는 저장하지 않습니다.
 */
export type RelatedNoteAiRecommendation = {
  /** 추천된 Note ID입니다. */
  noteId: string;

  /** 추천된 Note 제목입니다. */
  title: string;

  /** AI가 이 Note를 관련 노트로 추천한 이유입니다. */
  reason: string;
} & Record<string, Json | undefined>;

/**
 * 노트 상세 화면에 표시할 manual 관련 노트 항목입니다.
 */
export type ManualRelatedNoteRecommendation = {
  /** Related Notes 관계 row ID입니다. */
  relationId: string;

  /** 관련 Note ID입니다. */
  noteId: string;

  /** 조회 시점의 Related Note 제목입니다. */
  title: string;

  /** 사용자가 작성한 선택적 연결 이유입니다. */
  reason?: string;

  /** 사용자가 직접 연결한 관계입니다. */
  origin: "manual";
} & Record<string, Json | undefined>;

/**
 * 노트 상세 화면에 표시할 AI 관련 노트 항목입니다.
 */
export type AiRelatedNoteRecommendation = RelatedNoteAiRecommendation & {
  /** Related Notes 관계 row ID입니다. */
  relationId: string;

  /** AI가 생성한 관계입니다. */
  origin: "ai";
};

/**
 * 노트 상세 화면에 표시할 관련 노트 항목입니다.
 */
export type RelatedNoteRecommendation =
  | ManualRelatedNoteRecommendation
  | AiRelatedNoteRecommendation;
