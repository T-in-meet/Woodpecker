import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/db.helpers";

import type { RelatedNoteRecommendation } from "../types";

type SaveRelatedNoteRecommendationsParams = {
  /** 추천 결과를 저장할 대상 Note ID입니다. */
  noteId: string;

  /** 대상 Note에 대해 저장할 관련 노트 추천 목록입니다. */
  recommendations: RelatedNoteRecommendation[];
};

/**
 * 관련 노트 추천 결과를 대상 Note 기준으로 저장합니다.
 *
 * 추천 결과가 비어 있어도 빈 배열을 저장하여 이전 추천 결과를 명확히 대체합니다.
 *
 * @param params 저장할 대상 Note ID와 추천 결과
 */
export async function saveRelatedNoteRecommendations({
  noteId,
  recommendations,
}: SaveRelatedNoteRecommendationsParams): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("note_related_recommendations").upsert(
    {
      note_id: noteId,
      recommendations: recommendations as Json,
    },
    { onConflict: "note_id" },
  );

  if (error) {
    throw new Error(
      `Failed to save related note recommendations: ${error.message}`,
    );
  }
}
