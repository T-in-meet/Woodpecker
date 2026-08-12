import type { Json } from "@/types/db.helpers";

/**
 * 노트 상세 화면에 표시할 관련 노트 추천 항목입니다.
 *
 * v1은 Note ID와 제목 snapshot만 저장하지만, recommendations JSONB에
 * 추가 정보를 넣을 수 있도록 Json-compatible 확장 필드를 허용합니다.
 */
export type RelatedNoteRecommendation = {
  /** 추천된 Note ID입니다. */
  noteId: string;

  /** 추천 생성 시점의 Note 제목 snapshot입니다. */
  title: string;
} & Record<string, Json | undefined>;
