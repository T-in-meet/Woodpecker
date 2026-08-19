import type { Json } from "@/types/db.helpers";

/**
 * AI가 생성한 관련 노트 추천 결과입니다.
 */
export type RelatedNoteAiRecommendation = {
  /** 추천된 Note ID입니다. */
  noteId: string;

  /** 추천 생성 시점의 Note 제목 snapshot입니다. */
  title: string;
} & Record<string, Json | undefined>;

/**
 * 노트 상세 화면에 표시할 관련 노트 항목입니다.
 */
export type RelatedNoteRecommendation = RelatedNoteAiRecommendation & {
  /** 관련 노트 관계가 생성된 출처입니다. */
  origin: "manual" | "ai";
};
