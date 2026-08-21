import type { Json } from "@/types/db.helpers";

/**
 * AI가 생성한 관련 노트 추천 결과입니다.
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
  /** AI가 생성한 관계입니다. */
  origin: "ai";
};

/**
 * 노트 상세 화면에 표시할 관련 노트 항목입니다.
 */
export type RelatedNoteRecommendation =
  | ManualRelatedNoteRecommendation
  | AiRelatedNoteRecommendation;
