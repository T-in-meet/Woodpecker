import { after } from "next/server";

import {
  resolveAiRuntimeChatConfiguration,
  resolveAiRuntimeEmbeddingConfiguration,
} from "@/features/ai/runtimes";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  RELATED_NOTES_AI_FEATURE_KEY,
  RELATED_NOTES_AI_ROLE_KEY,
  RELATED_NOTES_MIN_SIMILARITY,
  RELATED_NOTES_SEARCH_LIMIT,
} from "../constants/ai";
import { replaceRelatedNoteAiRecommendations } from "../persistence/replace-related-note-ai-recommendations";
import { runRelatedNoteRecommendation } from "./run-related-note-recommendation";

type ScheduleRelatedNoteRecommendationParams = {
  /** AI 관련 노트를 추천할 대상 Note ID입니다. */
  noteId: string;

  /** 추천 대상 Note의 소유 사용자 ID입니다. */
  ownerUserId: string;
};

/**
 * 저장된 Note의 AI Related Notes 추천 생성을 응답 이후 후처리로 예약합니다.
 *
 * Note 저장/수정 자체와 AI 추천 생성을 분리하여,
 * Runtime 설정 조회, Query Expansion, RAG 검색, Answer Agent 실행 및
 * 추천 저장 시간이 사용자 저장 응답을 지연시키지 않도록 합니다.
 *
 * 후처리 시작 시 DB에서 Note의 최신 title/content/updated_at snapshot을
 * 다시 조회하여 동일한 Note version의 데이터를 추천 생성에 사용합니다.
 *
 * 추천 생성 중 Note가 다시 수정될 수 있으므로,
 * snapshot의 updated_at을 추천 저장 RPC에도 전달합니다.
 * RPC는 현재 Note의 updated_at과 비교한 뒤 동일한 version일 때만
 * active AI 추천을 교체하여 stale 추천이 최신 결과를 덮어쓰지 않도록 합니다.
 *
 * AI 추천 후처리 실패는 이미 성공한 Note 저장/수정 결과에 영향을 주지 않습니다.
 *
 * @param params 추천 대상 Note와 소유 사용자 정보
 */
export function scheduleRelatedNoteRecommendation({
  noteId,
  ownerUserId,
}: ScheduleRelatedNoteRecommendationParams): void {
  after(async () => {
    const supabase = createAdminClient();

    /*
     * 추천에 사용할 title/content/updated_at을 하나의 DB snapshot에서
     * 가져와 서로 다른 Note version의 값이 섞이지 않도록 합니다.
     *
     * service role client를 사용하지만 ownerUserId까지 함께 조건에 포함하여
     * 인증된 사용자가 저장한 자신의 Note만 후처리 대상으로 조회합니다.
     */
    const { data: recommendationSource, error: recommendationSourceError } =
      await supabase
        .from("notes")
        .select("id, title, content, updated_at")
        .eq("id", noteId)
        .eq("user_id", ownerUserId)
        .maybeSingle();

    /*
     * Note 조회 실패는 추천 실행 자체를 중단하되,
     * 이미 성공한 Note 저장/수정 결과에는 영향을 주지 않습니다.
     */
    if (recommendationSourceError) {
      console.error(
        "[Related Notes Recommendation Source Load Failed]",
        recommendationSourceError,
      );

      return;
    }

    /*
     * 조회는 정상적으로 완료됐지만 Note가 존재하지 않는 경우에는
     * 저장 이후 추천 후처리가 실행되기 전에 사용자가 Note를 삭제한
     * 정상적인 비동기 실행 경합일 수 있으므로 그대로 종료합니다.
     */
    if (!recommendationSource) {
      return;
    }

    try {
      /*
       * Related Notes의 Note 검색은 Note embedding, Note Chat 검색과
       * 동일한 Note embedding 저장소 및 embedding model을 사용합니다.
       *
       * 현재 Runtime Configuration은 기능별 Settings 구성을 유지하기 위해
       * Related Notes의 featureKey/roleKey를 사용하여 조회합니다.
       *
       * TODO
       * Note embedding 생성, Note Chat 검색, Related Notes 검색이 모두
       * 동일한 Note retrieval embedding을 사용하고 있으므로,
       * NOTE_RETRIEVAL Runtime을 기능별 상수로 각각 유지하는 것이 적절한지
       * 또는 공통 AI/RAG 상수로 통일하는 것이 더 명확한지 별도로 점검합니다.
       *
       * 통일 여부를 검토할 때에는 단순 상수 이름뿐 아니라
       * AI Settings에서 featureKey/roleKey별 Runtime 설정을 관리하는 현재 구조와
       * 각 기능이 동일 embedding model을 반드시 사용해야 하는 제약까지
       * 함께 확인해야 합니다.
       */
      const embeddingConfiguration =
        await resolveAiRuntimeEmbeddingConfiguration({
          featureKey: RELATED_NOTES_AI_FEATURE_KEY,
          roleKey: RELATED_NOTES_AI_ROLE_KEY.NOTE_RETRIEVAL,
        });

      const queryExpansionConfiguration =
        await resolveAiRuntimeChatConfiguration({
          featureKey: RELATED_NOTES_AI_FEATURE_KEY,
          roleKey: RELATED_NOTES_AI_ROLE_KEY.QUERY_EXPANSION,
        });

      const answerConfiguration = await resolveAiRuntimeChatConfiguration({
        featureKey: RELATED_NOTES_AI_FEATURE_KEY,
        roleKey: RELATED_NOTES_AI_ROLE_KEY.ANSWER_GENERATION,
      });

      const result = await runRelatedNoteRecommendation({
        answerConfiguration,
        content: recommendationSource.content,
        embeddingConfiguration,
        limit: RELATED_NOTES_SEARCH_LIMIT,
        minSimilarity: RELATED_NOTES_MIN_SIMILARITY,
        ownerUserId,
        queryExpansionConfiguration,
        targetNoteId: recommendationSource.id,
        title: recommendationSource.title,
      });

      /*
       * 추천 생성에 사용한 Note snapshot의 updated_at을 함께 전달합니다.
       *
       * 추천 생성 중 Note가 다시 수정됐다면 RPC에서 stale 실행으로 판단하여
       * 기존 active AI 추천을 변경하지 않고 종료합니다.
       */
      await replaceRelatedNoteAiRecommendations({
        noteId: recommendationSource.id,
        recommendations: result.recommendations,
        sourceUpdatedAt: recommendationSource.updated_at,
      });

      console.log("[Related Notes Recommendation]", {
        expandedQuery: result.expandedQuery,
        matchedNoteIds: result.notes.map((note) => note.id),
        recommendedNoteIds: result.recommendations.map(
          (recommendation) => recommendation.noteId,
        ),
      });
    } catch (error) {
      /*
       * Runtime Configuration 조회, Provider 호출, RAG 검색 또는
       * 추천 저장이 실패하더라도 Note 자체는 이미 정상 저장된 상태입니다.
       *
       * 후처리 오류를 다시 throw하지 않아 Note 생성/수정 결과와
       * AI Related Notes 추천 실행을 분리합니다.
       */
      console.error("[Related Notes Recommendation Failed]", error);
    }
  });
}
