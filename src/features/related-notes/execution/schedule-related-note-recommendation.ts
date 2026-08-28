import { after } from "next/server";

import {
  NOTE_RETRIEVAL_AI_FEATURE_KEY,
  NOTE_RETRIEVAL_AI_ROLE_KEY,
} from "@/features/ai/rags/note/constants/runtime";
import {
  resolveAiRuntimeChatConfiguration,
  resolveAiRuntimeEmbeddingConfiguration,
} from "@/features/ai/runtimes";
import {
  RELATED_NOTES_OPERATIONAL_ERROR_CODES,
  RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  RELATED_NOTES_AI_FEATURE_KEY,
  RELATED_NOTES_AI_ROLE_KEY,
  RELATED_NOTES_MIN_SIMILARITY,
  RELATED_NOTES_SEARCH_LIMIT,
} from "../constants/ai";
import {
  REPLACE_RELATED_NOTE_AI_RECOMMENDATIONS_STATUS,
  replaceRelatedNoteAiRecommendations,
  type ReplaceRelatedNoteAiRecommendationsStatus,
} from "../persistence/replace-related-note-ai-recommendations";
import { reportRelatedNotesOperationalError } from "../utils/report-operational-error";
import {
  claimRelatedNoteRecommendationExecution,
  completeRelatedNoteRecommendationExecutionClaim,
  RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_COMPLETION_STATUS,
  RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS,
  type RelatedNoteRecommendationExecutionClaimCompletionStatus,
} from "./execution-claim-persistence";
import {
  completeRelatedNoteRecommendationRun,
  createRelatedNoteRecommendationRunRecord,
  RELATED_NOTE_RECOMMENDATION_RUN_STATUS,
  RELATED_NOTE_RECOMMENDATION_RUN_UPDATE_STEP,
  type RelatedNoteRecommendationRunUpdateStep,
  saveRelatedNoteRunAnswerGenerationUsage,
  saveRelatedNoteRunExpandedQuery,
  saveRelatedNoteRunMatchedNotes,
  saveRelatedNoteRunQueryEmbedding,
  saveRelatedNoteRunQueryExpansion,
  saveRelatedNoteRunRecommendations,
  saveRelatedNoteRunVerificationResults,
  saveRelatedNoteRunVerificationUsage,
} from "./run-persistence";
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
 * Related Notes execution claim은 quota, 관리자 bypass, 동일 Note version 중복
 * 실행 방지를 담당합니다. run 기록은 기능 제어에 사용하지 않습니다.
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
      await reportRelatedNotesOperationalError({
        error: recommendationSourceError,
        errorCode:
          RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_SOURCE_LOAD_FAILED,
        message: "Related Note 추천을 위한 Note source 조회에 실패했습니다.",
        operation:
          RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.LOAD_RECOMMENDATION_SOURCE,
        context: {
          noteId,
        },
        userId: ownerUserId,
      });

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

    let activeClaimId: string | null = null;
    let activeRunId: string | null = null;

    try {
      let claimResult: Awaited<
        ReturnType<typeof claimRelatedNoteRecommendationExecution>
      >;

      try {
        claimResult = await claimRelatedNoteRecommendationExecution({
          noteId: recommendationSource.id,
          sourceUpdatedAt: recommendationSource.updated_at,
          userId: ownerUserId,
        });
      } catch (error) {
        await reportRelatedNotesOperationalError({
          error,
          errorCode:
            RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_EXECUTION_CLAIM_FAILED,
          message: "Related Note 추천 실행 선점에 실패했습니다.",
          operation:
            RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.CLAIM_RECOMMENDATION_EXECUTION,
          context: {
            noteId: recommendationSource.id,
          },
          userId: ownerUserId,
        });

        console.error(
          "[Related Notes Recommendation Execution Claim Failed]",
          error,
        );

        return;
      }

      if (
        claimResult.status ===
        RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.DAILY_LIMIT_EXCEEDED
      ) {
        console.info("[Related Notes Recommendation Daily Limit Exceeded]", {
          noteId: recommendationSource.id,
          ownerUserId,
        });

        return;
      }

      if (
        claimResult.status ===
          RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.DUPLICATE ||
        claimResult.status ===
          RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_STATUS.STALE
      ) {
        return;
      }

      activeClaimId = claimResult.claimId;

      /*
       * Related Notes의 Note 검색은 Note embedding 생성, Note Chat 검색과
       * 동일한 공통 Note retrieval Runtime을 사용합니다.
       *
       * 검색은 model_config_id가 일치하는 활성 Note embedding generation만
       * 대상으로 삼으므로 기능별 Runtime을 분리하지 않습니다.
       */
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

      try {
        activeRunId = await createRelatedNoteRecommendationRunRecord({
          answerGenerationModelConfigId: answerConfiguration.model.id,
          embeddingModelConfigId: embeddingConfiguration.model.id,
          noteId: recommendationSource.id,
          queryExpansionModelConfigId: queryExpansionConfiguration.model.id,
          sourceUpdatedAt: recommendationSource.updated_at,
          userId: ownerUserId,
          verificationModelConfigId: verificationConfiguration.model.id,
        });
      } catch (error) {
        await reportRelatedNotesOperationalError({
          error,
          errorCode:
            RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_RUN_CREATE_FAILED,
          message: "Related Note 추천 실행 이력 생성에 실패했습니다.",
          operation:
            RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.CREATE_RECOMMENDATION_RUN,
          context: {
            noteId: recommendationSource.id,
          },
          userId: ownerUserId,
        });

        console.error(
          "[Related Notes Recommendation Run Record Create Failed]",
          error,
        );
      }

      const result = await runRelatedNoteRecommendation({
        answerConfiguration,
        content: recommendationSource.content,
        embeddingConfiguration,
        limit: RELATED_NOTES_SEARCH_LIMIT,
        minSimilarity: RELATED_NOTES_MIN_SIMILARITY,

        onAnswerGenerationUsage: async (usage) => {
          await saveRunUpdateOrReport({
            noteId: recommendationSource.id,
            ownerUserId,
            runId: activeRunId,
            step: RELATED_NOTE_RECOMMENDATION_RUN_UPDATE_STEP.ANSWER_GENERATION,
            update: (runId) =>
              saveRelatedNoteRunAnswerGenerationUsage({
                modelKey: createAiUsageModelKey(answerConfiguration.model),
                runId,
                usage,
              }),
          });
        },

        /*
         * Provider 호출 직후 Query Expansion usage/cost를 저장합니다.
         *
         * 이후 응답 파싱 또는 schema 검증이 실패하더라도
         * 이미 발생한 Provider 비용을 Run에 보존합니다.
         */
        onQueryExpansionUsage: async (usage) => {
          await saveRunUpdateOrReport({
            noteId: recommendationSource.id,
            ownerUserId,
            runId: activeRunId,
            step: RELATED_NOTE_RECOMMENDATION_RUN_UPDATE_STEP.QUERY_EXPANSION,
            update: (runId) =>
              saveRelatedNoteRunQueryExpansion({
                modelKey: createAiUsageModelKey(
                  queryExpansionConfiguration.model,
                ),
                runId,
                usage,
              }),
          });
        },

        /*
         * 파싱과 검증을 통과한 expanded query만 별도로 저장합니다.
         *
         * usage/cost는 onQueryExpansionUsage에서 이미 저장했으므로
         * 여기서는 다시 갱신하지 않습니다.
         */
        onExpandedQuery: async (expandedQuery) => {
          await saveRunUpdateOrReport({
            noteId: recommendationSource.id,
            ownerUserId,
            runId: activeRunId,
            step: RELATED_NOTE_RECOMMENDATION_RUN_UPDATE_STEP.QUERY_EXPANSION,
            update: (runId) =>
              saveRelatedNoteRunExpandedQuery({
                expandedQuery,
                runId,
              }),
          });
        },

        onMatchedNotes: async (matchedNoteIds) => {
          await saveRunUpdateOrReport({
            noteId: recommendationSource.id,
            ownerUserId,
            runId: activeRunId,
            step: RELATED_NOTE_RECOMMENDATION_RUN_UPDATE_STEP.MATCHED_NOTES,
            update: (runId) =>
              saveRelatedNoteRunMatchedNotes({
                matchedNoteIds,
                runId,
              }),
          });
        },

        onQueryEmbeddingUsage: async (usage) => {
          await saveRunUpdateOrReport({
            noteId: recommendationSource.id,
            ownerUserId,
            runId: activeRunId,
            step: RELATED_NOTE_RECOMMENDATION_RUN_UPDATE_STEP.QUERY_EMBEDDING,
            update: (runId) =>
              saveRelatedNoteRunQueryEmbedding({
                modelKey: createAiUsageModelKey(embeddingConfiguration.model),
                runId,
                usage,
              }),
          });
        },

        onRecommendations: async (recommendations) => {
          await saveRunUpdateOrReport({
            noteId: recommendationSource.id,
            ownerUserId,
            runId: activeRunId,
            step: RELATED_NOTE_RECOMMENDATION_RUN_UPDATE_STEP.RECOMMENDATIONS,
            update: (runId) =>
              saveRelatedNoteRunRecommendations({
                recommendations,
                runId,
              }),
          });
        },

        onVerificationResults: async (verifications) => {
          await saveRunUpdateOrReport({
            noteId: recommendationSource.id,
            ownerUserId,
            runId: activeRunId,
            step: RELATED_NOTE_RECOMMENDATION_RUN_UPDATE_STEP.VERIFICATION,
            update: (runId) =>
              saveRelatedNoteRunVerificationResults({
                runId,
                verifications,
              }),
          });
        },

        onVerificationUsage: async (usage) => {
          await saveRunUpdateOrReport({
            noteId: recommendationSource.id,
            ownerUserId,
            runId: activeRunId,
            step: RELATED_NOTE_RECOMMENDATION_RUN_UPDATE_STEP.VERIFICATION,
            update: (runId) =>
              saveRelatedNoteRunVerificationUsage({
                modelKey: createAiUsageModelKey(
                  verificationConfiguration.model,
                ),
                runId,
                usage,
              }),
          });
        },

        ownerUserId,
        queryExpansionConfiguration,
        targetNoteId: recommendationSource.id,
        title: recommendationSource.title,
        verificationConfiguration,
      });

      /*
       * 추천 생성에 사용한 Note snapshot의 updated_at을 함께 전달합니다.
       *
       * 추천 생성 중 Note가 다시 수정됐다면 RPC에서 stale 실행으로 판단하여
       * 기존 active AI 추천을 변경하지 않고 종료합니다.
       */
      let replaceStatus: ReplaceRelatedNoteAiRecommendationsStatus;

      try {
        replaceStatus = await replaceRelatedNoteAiRecommendations({
          noteId: recommendationSource.id,
          ownerUserId,
          recommendations: result.recommendations,
          sourceUpdatedAt: recommendationSource.updated_at,
        });
      } catch (error) {
        await reportRelatedNotesOperationalError({
          error,
          errorCode:
            RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATIONS_REPLACE_FAILED,
          message: "Related Note AI 추천 교체에 실패했습니다.",
          operation:
            RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.REPLACE_RECOMMENDATIONS,
          context: {
            noteId: recommendationSource.id,
          },
          userId: ownerUserId,
        });

        throw error;
      }

      const runStatus =
        replaceStatus ===
        REPLACE_RELATED_NOTE_AI_RECOMMENDATIONS_STATUS.REPLACED
          ? RELATED_NOTE_RECOMMENDATION_RUN_STATUS.SUCCEEDED
          : RELATED_NOTE_RECOMMENDATION_RUN_STATUS.STALE;
      const claimCompletionStatus =
        replaceStatus ===
        REPLACE_RELATED_NOTE_AI_RECOMMENDATIONS_STATUS.REPLACED
          ? RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_COMPLETION_STATUS.SUCCEEDED
          : RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_COMPLETION_STATUS.STALE;

      /*
       * Run이 정상적으로 생성된 경우에만 완료 상태를 기록합니다.
       *
       * Run 완료 기록 실패는 이미 결정된 추천 저장 결과를 되돌리거나
       * 추천 실행 자체를 실패로 바꾸지 않습니다.
       */
      if (activeRunId !== null) {
        await completeRunOrReport({
          noteId: recommendationSource.id,
          ownerUserId,
          runId: activeRunId,
          status: runStatus,
        });
      }

      await completeExecutionClaimOrReport({
        claimId: activeClaimId,
        noteId: recommendationSource.id,
        ownerUserId,
        status: claimCompletionStatus,
      });
    } catch (error) {
      /*
       * 실제 추천 실행이 실패한 경우, Run이 존재하면 failed 상태 기록을 시도합니다.
       *
       * Run 완료 기록 자체의 실패는 operational error로 별도 기록되며
       * 원래 background job 실패 처리에는 영향을 주지 않습니다.
       */
      if (activeRunId !== null) {
        await completeRunOrReport({
          failureMessage:
            error instanceof Error ? error.message : "Unknown error",
          noteId,
          ownerUserId,
          runId: activeRunId,
          status: RELATED_NOTE_RECOMMENDATION_RUN_STATUS.FAILED,
        });
      }

      if (activeClaimId !== null) {
        await completeExecutionClaimOrReport({
          claimId: activeClaimId,
          noteId,
          ownerUserId,
          status:
            RELATED_NOTE_RECOMMENDATION_EXECUTION_CLAIM_COMPLETION_STATUS.FAILED,
        });
      }

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

/**
 * AI Model Config를 usage pricing table에서 사용하는 model key로 변환합니다.
 *
 * 현재 pricing table은 seed에서 사용하는 `${provider}-${model}` 형태를 key로 사용합니다.
 *
 * @param model Runtime에서 확정된 AI Model Config
 * @returns 비용 추정에 사용할 model key
 */
function createAiUsageModelKey(model: { provider: string; model: string }) {
  return `${model.provider}-${model.model}`;
}

/**
 * Related Notes 추천 Run 갱신을 시도하고 실패 시 운영 오류를 기록합니다.
 *
 * Run은 추천 기능의 관측/감사용 보조 데이터이므로,
 * Run이 생성되지 않았거나 갱신에 실패해도 실제 추천 실행은 중단하지 않습니다.
 *
 * @param params Run 갱신 작업과 오류 보고 context
 */
async function saveRunUpdateOrReport(params: {
  noteId: string;
  ownerUserId: string;
  runId: string | null;
  step: RelatedNoteRecommendationRunUpdateStep;
  update: (runId: string) => Promise<void>;
}): Promise<void> {
  if (params.runId === null) {
    return;
  }

  try {
    await params.update(params.runId);
  } catch (error) {
    await reportRelatedNotesOperationalError({
      error,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_RUN_UPDATE_FAILED,
      message: "Related Note 추천 실행 이력 갱신에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.UPDATE_RECOMMENDATION_RUN,
      context: {
        noteId: params.noteId,
        runId: params.runId,
        runStatus: RELATED_NOTE_RECOMMENDATION_RUN_STATUS.RUNNING,
        runUpdateStep: params.step,
      },
      userId: params.ownerUserId,
    });

    console.error("[Related Notes Recommendation Run Update Failed]", error);
  }
}

/**
 * Related Notes 추천 Run 완료를 시도하고 실패 시 운영 오류를 기록합니다.
 *
 * Run 완료 실패는 실제 추천 저장 결과나 background job의 성공/실패 상태를
 * 변경하지 않는 관측 계층의 오류로 처리합니다.
 *
 * @param params Run 완료 작업과 오류 보고 context
 */
async function completeRunOrReport(params: {
  failureMessage?: string;
  noteId: string;
  ownerUserId: string;
  runId: string;
  status:
    | typeof RELATED_NOTE_RECOMMENDATION_RUN_STATUS.SUCCEEDED
    | typeof RELATED_NOTE_RECOMMENDATION_RUN_STATUS.FAILED
    | typeof RELATED_NOTE_RECOMMENDATION_RUN_STATUS.STALE;
}): Promise<void> {
  try {
    await completeRelatedNoteRecommendationRun({
      ...(params.failureMessage !== undefined
        ? { failureMessage: params.failureMessage }
        : {}),
      runId: params.runId,
      status: params.status,
    });
  } catch (error) {
    await reportRelatedNotesOperationalError({
      error,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_RUN_COMPLETE_FAILED,
      message: "Related Note 추천 실행 이력 완료 처리에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.COMPLETE_RECOMMENDATION_RUN,
      context: {
        noteId: params.noteId,
        runId: params.runId,
        runStatus: params.status,
      },
      userId: params.ownerUserId,
    });

    console.error("[Related Notes Recommendation Run Complete Failed]", error);
  }
}

/**
 * Related Notes 추천 execution claim 완료를 시도하고 실패 시 운영 오류를 기록합니다.
 *
 * execution claim은 run 기록과 달리 active claim 해제 책임이 있으므로,
 * 추천 실행이 끝난 뒤 성공/실패/stale 상태를 기록합니다.
 *
 * @param params execution claim 완료 작업과 오류 보고 context
 */
async function completeExecutionClaimOrReport(params: {
  claimId: string | null;
  noteId: string;
  ownerUserId: string;
  status: RelatedNoteRecommendationExecutionClaimCompletionStatus;
}): Promise<void> {
  if (params.claimId === null) {
    return;
  }

  try {
    await completeRelatedNoteRecommendationExecutionClaim({
      claimId: params.claimId,
      status: params.status,
    });
  } catch (error) {
    await reportRelatedNotesOperationalError({
      error,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_EXECUTION_CLAIM_COMPLETE_FAILED,
      message: "Related Note 추천 실행 선점 완료 처리에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.COMPLETE_RECOMMENDATION_EXECUTION_CLAIM,
      context: {
        claimId: params.claimId,
        claimStatus: params.status,
        noteId: params.noteId,
      },
      userId: params.ownerUserId,
    });

    console.error(
      "[Related Notes Recommendation Execution Claim Complete Failed]",
      error,
    );
  }
}
