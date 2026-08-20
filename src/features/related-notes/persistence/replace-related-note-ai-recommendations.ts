import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/db.helpers";

import type { RelatedNoteAiRecommendation } from "../types";

type ReplaceRelatedNoteAiRecommendationsParams = {
  /** AI 추천 결과를 교체할 대상 Note ID입니다. */
  noteId: string;

  /** AI 추천 대상 Note와 추천 target Note의 소유 사용자 ID입니다. */
  ownerUserId: string;

  /**
   * AI 추천 생성에 사용한 Note snapshot의 updated_at입니다.
   *
   * DB RPC에서 현재 Note의 updated_at과 비교하여,
   * 추천 생성 이후 Note가 다시 수정된 경우 stale 추천이
   * 최신 추천을 덮어쓰지 않도록 합니다.
   */
  sourceUpdatedAt: string;

  /** 대상 Note에 새로 저장할 AI 관련 노트 추천 목록입니다. */
  recommendations: RelatedNoteAiRecommendation[];
};

/**
 * 대상 Note의 현재 AI 관련 노트 추천을 새로운 추천 결과로 교체합니다.
 *
 * DB RPC에서 추천 생성에 사용한 Note snapshot의 updated_at과
 * 현재 Note의 updated_at을 비교한 뒤,
 * 동일한 Note version일 때만 기존 active AI 추천 삭제와
 * 새 추천 저장을 하나의 트랜잭션으로 처리합니다.
 *
 * 사용자가 직접 연결한 manual 관계와 사용자가 거부한 dismissed
 * AI 관계는 RPC에서 유지합니다.
 *
 * @param params 대상 Note ID, 추천 생성에 사용한 Note version 및 새 AI 추천 결과
 */
export async function replaceRelatedNoteAiRecommendations({
  noteId,
  ownerUserId,
  sourceUpdatedAt,
  recommendations,
}: ReplaceRelatedNoteAiRecommendationsParams): Promise<void> {
  const supabase = createAdminClient();

  const recommendationPayload = recommendations.map(
    ({ noteId: relatedNoteId, ...metadata }) => ({
      relatedNoteId,
      metadata,
    }),
  ) satisfies Json;

  const { error } = await supabase.rpc(
    "replace_note_related_ai_recommendations",
    {
      p_note_id: noteId,
      p_owner_user_id: ownerUserId,
      p_source_updated_at: sourceUpdatedAt,
      p_recommendations: recommendationPayload,
    },
  );

  if (error) {
    throw new Error(
      `Failed to replace related note AI recommendations: ${error.message}`,
    );
  }
}
