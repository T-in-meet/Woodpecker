import { after } from "next/server";

import {
  NOTE_RETRIEVAL_AI_FEATURE_KEY,
  NOTE_RETRIEVAL_AI_ROLE_KEY,
} from "@/features/ai/rags/note/constants/runtime";
import {
  checkpointAiRun,
  completeAiRunFailed,
  completeAiRunSucceeded,
  createAiRun,
} from "@/features/ai/runs/persistence";
import { AI_RUN_FEATURE_TYPE } from "@/features/ai/runs/types";
import {
  resolveAiRuntimeChatConfiguration,
  resolveAiRuntimeEmbeddingConfiguration,
} from "@/features/ai/runtimes";
import {
  RELATED_NOTES_OPERATIONAL_ERROR_CODES,
  RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import { createRelatedNotesSnapshotAccumulator } from "../ai-runs/snapshot-accumulator";
import {
  RELATED_NOTES_AI_FEATURE_KEY,
  RELATED_NOTES_AI_ROLE_KEY,
  RELATED_NOTES_MIN_SIMILARITY,
  RELATED_NOTES_SEARCH_LIMIT,
} from "../constants/ai";
import {
  REPLACE_RELATED_NOTE_AI_RECOMMENDATIONS_STATUS,
  replaceRelatedNoteAiRecommendations,
} from "../persistence/replace-related-note-ai-recommendations";
import { reportRelatedNotesOperationalError } from "../utils/report-operational-error";
import {
  claimRelatedNoteRecommendationExecution,
  type ClaimRelatedNoteRecommendationExecutionResult,
  completeRelatedNoteRecommendationExecutionClaim,
  RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_COMPLETION_STATUS,
  RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS,
  type RelatedNoteRecommendationExecutionClaimCompletionStatus,
} from "./execution-claim-persistence";
import { runRelatedNoteRecommendation } from "./run-related-note-recommendation";

/** Related Notes 추천 예약 입력입니다. */
type ScheduleRelatedNoteRecommendationParams = {
  noteId: string;
  ownerUserId: string;
};

/** 사용자가 요청한 Related Notes 추천을 claim한 뒤 응답 이후 실행합니다. */
export async function scheduleRelatedNoteRecommendation({
  noteId,
  ownerUserId,
}: ScheduleRelatedNoteRecommendationParams): Promise<ClaimRelatedNoteRecommendationExecutionResult> {
  const supabase = createAdminClient();

  // AI 입력으로 사용할 source Note와 version을 소유권 조건 아래 한 번에 읽는다.
  const { data: source, error: sourceError } = await supabase
    .from("notes")
    .select("id, title, content, updated_at")
    .eq("id", noteId)
    .eq("user_id", ownerUserId)
    .maybeSingle();

  if (sourceError) {
    await reportRelatedNotesOperationalError({
      context: { noteId },
      error: sourceError,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_SOURCE_LOAD_FAILED,
      message: "Related Note 추천을 위한 Note source 조회에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RECOMMENDATION_SOURCE,
      userId: ownerUserId,
    });
    console.error(
      "[Related Notes Recommendation Source Load Failed]",
      sourceError,
    );
    throw sourceError;
  }

  if (!source)
    return {
      claimId: null,
      status: RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.STALE,
    };

  let claimResult: ClaimRelatedNoteRecommendationExecutionResult;
  try {
    claimResult = await claimRelatedNoteRecommendationExecution({
      noteId: source.id,
      sourceUpdatedAt: source.updated_at,
      userId: ownerUserId,
    });
  } catch (error) {
    await reportRelatedNotesOperationalError({
      context: { noteId: source.id },
      error,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_EXECUTION_CLAIM_FAILED,
      message: "Related Note 추천 실행 선점에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.CLAIM_RECOMMENDATION_EXECUTION,
      userId: ownerUserId,
    });
    console.error(
      "[Related Notes Recommendation Execution Claim Failed]",
      error,
    );
    throw error;
  }

  // 실행 권한을 얻지 못한 결과에는 Runtime 조회나 AI Run을 만들지 않는다.
  if (
    claimResult.status !==
    RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.CLAIMED
  ) {
    if (
      claimResult.status ===
      RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.DAILY_LIMIT_EXCEEDED
    )
      console.info("[Related Notes Recommendation Daily Limit Exceeded]", {
        noteId: source.id,
        ownerUserId,
      });
    return claimResult;
  }

  const claimId = claimResult.claimId;
  after(async () => {
    try {
      // 기존 네 Runtime 설정은 AI Run 생성보다 먼저 병렬로 확정한다.
      const [
        embeddingConfiguration,
        queryExpansionConfiguration,
        answerConfiguration,
        verificationConfiguration,
      ] = await Promise.all([
        resolveAiRuntimeEmbeddingConfiguration({
          featureKey: NOTE_RETRIEVAL_AI_FEATURE_KEY,
          roleKey: NOTE_RETRIEVAL_AI_ROLE_KEY,
        }),
        resolveAiRuntimeChatConfiguration({
          featureKey: RELATED_NOTES_AI_FEATURE_KEY,
          roleKey: RELATED_NOTES_AI_ROLE_KEY.QUERY_EXPANSION,
        }),
        resolveAiRuntimeChatConfiguration({
          featureKey: RELATED_NOTES_AI_FEATURE_KEY,
          roleKey: RELATED_NOTES_AI_ROLE_KEY.ANSWER_GENERATION,
        }),
        resolveAiRuntimeChatConfiguration({
          featureKey: RELATED_NOTES_AI_FEATURE_KEY,
          roleKey: RELATED_NOTES_AI_ROLE_KEY.VERIFICATION,
        }),
      ]);

      const accumulator = createRelatedNotesSnapshotAccumulator({
        content: source.content,
        id: source.id,
        title: source.title,
        updatedAt: source.updated_at,
      });
      const aiRunId = await createAiRun({
        buildSnapshot: accumulator.buildSnapshot,
        featureType: AI_RUN_FEATURE_TYPE.RELATED_NOTES,
        startedAt: new Date().toISOString(),
        userId: ownerUserId,
      });

      let result: Awaited<ReturnType<typeof runRelatedNoteRecommendation>>;
      try {
        result = await runRelatedNoteRecommendation({
          answerConfiguration,
          content: source.content,
          embeddingConfiguration,
          limit: RELATED_NOTES_SEARCH_LIMIT,
          minSimilarity: RELATED_NOTES_MIN_SIMILARITY,
          onCheckpoint: () =>
            checkpointAiRun({
              aiRunId,
              buildSnapshot: accumulator.buildSnapshot,
              userId: ownerUserId,
            }),
          ownerUserId,
          queryExpansionConfiguration,
          snapshotAccumulator: accumulator,
          targetNoteId: source.id,
          title: source.title,
          verificationConfiguration,
        });
      } catch (error) {
        await completeAiRunFailed({
          aiRunId,
          buildSnapshot: accumulator.buildSnapshot,
          completedAt: new Date().toISOString(),
          userId: ownerUserId,
        });
        await completeClaimOrReport({
          claimId,
          noteId: source.id,
          ownerUserId,
          status:
            RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_COMPLETION_STATUS.FAILED,
        });
        console.error("[Related Notes Recommendation Failed]", error);
        return;
      }

      let featureResultIds: string[] = [];
      let claimStatus: RelatedNoteRecommendationExecutionClaimCompletionStatus =
        RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_COMPLETION_STATUS.FAILED;
      try {
        // replacement는 AI 성공 경계 밖이며 같은 RPC가 저장 UUID를 반환한다.
        const replacement = await replaceRelatedNoteAiRecommendations({
          noteId: source.id,
          ownerUserId,
          recommendations: result.recommendations,
          sourceUpdatedAt: source.updated_at,
        });
        if (
          replacement.status ===
          REPLACE_RELATED_NOTE_AI_RECOMMENDATIONS_STATUS.REPLACED
        ) {
          featureResultIds = replacement.relationIds;
          claimStatus =
            RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_COMPLETION_STATUS.SUCCEEDED;
        } else
          claimStatus =
            RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_COMPLETION_STATUS.STALE;
      } catch (error) {
        await reportRelatedNotesOperationalError({
          context: { noteId: source.id },
          error,
          errorCode:
            RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATIONS_REPLACE_FAILED,
          message: "Related Note AI 추천 교체에 실패했습니다.",
          operation:
            RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.REPLACE_RECOMMENDATIONS,
          userId: ownerUserId,
        });
      }

      // Final Output 이후 Related Notes replacement 결과와 무관하게 AI 성공으로 보고 succeeded terminal 저장을 시도한다.
      await completeAiRunSucceeded({
        aiRunId,
        buildSnapshot: accumulator.buildSnapshot,
        completedAt: new Date().toISOString(),
        featureResultIds,
        userId: ownerUserId,
      });
      await completeClaimOrReport({
        claimId,
        noteId: source.id,
        ownerUserId,
        status: claimStatus,
      });
    } catch (error) {
      // Runtime 설정 등 AI 시작 전 실패에는 Run 없이 Claim만 정리한다.
      await completeClaimOrReport({
        claimId,
        noteId: source.id,
        ownerUserId,
        status:
          RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_COMPLETION_STATUS.FAILED,
      });
      console.error("[Related Notes Recommendation Failed]", error);
    }
  });

  return claimResult;
}

/** Related Notes execution claim 완료를 best-effort로 처리합니다. */
async function completeClaimOrReport(params: {
  claimId: string | null;
  noteId: string;
  ownerUserId: string;
  status: RelatedNoteRecommendationExecutionClaimCompletionStatus;
}): Promise<void> {
  if (params.claimId === null) return;
  try {
    await completeRelatedNoteRecommendationExecutionClaim({
      claimId: params.claimId,
      status: params.status,
      userId: params.ownerUserId,
    });
  } catch (error) {
    await reportRelatedNotesOperationalError({
      context: {
        claimId: params.claimId,
        claimStatus: params.status,
        noteId: params.noteId,
      },
      error,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_EXECUTION_CLAIM_COMPLETE_FAILED,
      message: "Related Note 추천 실행 선점 완료 처리에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.COMPLETE_RECOMMENDATION_EXECUTION_CLAIM,
      userId: params.ownerUserId,
    });
    console.error(
      "[Related Notes Recommendation Execution Claim Complete Failed]",
      error,
    );
  }
}
