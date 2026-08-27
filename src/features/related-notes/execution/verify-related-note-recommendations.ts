import { z } from "zod";

import { renderPromptTemplate } from "@/features/ai/prompts/render";
import { createAiChatCompletionWithProvider } from "@/features/ai/providers";
import type { AiTokenUsage } from "@/features/ai/providers/types";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import type { MatchedNote } from "@/features/ai/rags/note/get-matched-notes";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";
import {
  RELATED_NOTES_OPERATIONAL_ERROR_CODES,
  RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";
import type { Json } from "@/types/db.helpers";

import type {
  RelatedNoteAiRecommendation,
  StoredRelatedNoteAiRecommendation,
} from "../types";
import { reportRelatedNotesOperationalError } from "../utils/report-operational-error";

/**
 * Related Notes Verifier Agent의 원본 JSON 응답 계약입니다.
 */
const relatedNoteVerificationResponseSchema = z.object({
  verifications: z.array(
    z.object({
      noteId: z.string().uuid(),
      approved: z.boolean(),
      reason: z.string().trim().min(1),
    }),
  ),
});

/**
 * Verifier Agent가 개별 추천에 대해 반환한 판정입니다.
 */
export type RelatedNoteVerification = {
  /** 검증 대상 추천 Note ID입니다. */
  noteId: string;

  /** 최종 저장 승인 여부입니다. */
  approved: boolean;

  /** 승인 또는 거부 판단 근거입니다. */
  reason: string;
};

type VerifyRelatedNoteRecommendationsParams = {
  /** 추천 검증에 사용할 Verifier Runtime Configuration입니다. */
  configuration: AiRuntimeChatConfiguration;

  /** 추천 대상 원본 Note 제목입니다. */
  title: string;

  /** 추천 대상 원본 Note 내용입니다. */
  content: string;

  /** Answer Agent가 선택한 추천 목록입니다. */
  recommendations: RelatedNoteAiRecommendation[];

  /** Retrieval에서 실제 매칭된 Note chunk 목록입니다. */
  notes: MatchedNote[];

  /** Provider 응답 직후 Token usage를 저장하기 위한 callback입니다. */
  onUsage?: (usage: AiTokenUsage) => Promise<void>;
};

/**
 * Related Notes Verifier 실행 결과입니다.
 */
export type VerifyRelatedNoteRecommendationsResult = {
  /** Verifier가 승인한 최종 저장 대상 추천 목록입니다. */
  recommendations: StoredRelatedNoteAiRecommendation[];

  /** Answer 추천마다 정확히 하나씩 존재하는 검증 결과입니다. */
  verifications: RelatedNoteVerification[];

  /** Verifier Provider 호출에서 반환된 Token 사용량입니다. */
  usage: AiTokenUsage;
};

/**
 * Answer Agent가 생성한 모든 Related Notes 추천을 하나의 Verifier 호출로 검증합니다.
 *
 * Verifier는 각 Answer 추천에 대해 Retrieval에서 실제 매칭된 모든 chunk를
 * 근거로 승인 여부를 판단합니다. Verifier 응답은 Answer 추천 noteId 집합과
 * 정확히 1:1로 일치해야 하며, 누락/추가/중복이 있으면 검증 실패로 처리합니다.
 *
 * @param params Verifier Runtime 설정, 원본 Note, Answer 추천 및 검색 chunk
 * @returns 승인된 저장 대상 추천과 검증 snapshot
 */
export async function verifyRelatedNoteRecommendations({
  configuration,
  title,
  content,
  recommendations,
  notes,
  onUsage,
}: VerifyRelatedNoteRecommendationsParams): Promise<VerifyRelatedNoteRecommendationsResult> {
  await assertRecommendationsHaveEvidence({
    notes,
    recommendations,
  });

  const verificationContext = buildRelatedNoteVerificationContext({
    notes,
    recommendations,
  });

  const promptVersion = configuration.prompt.version;
  const model = configuration.model;
  const responseSchema = promptVersion.response_schema;
  const templateVariables = {
    content,
    recommendations: verificationContext,
    title,
  };

  const systemPrompt = renderPromptTemplate(
    promptVersion.system_template,
    templateVariables,
  );

  const userPrompt = renderPromptTemplate(
    promptVersion.user_template,
    templateVariables,
  );

  const result = await createAiChatCompletionWithProvider({
    apiKey: getProviderApiKey(model.provider),
    model: model.model,
    provider: model.provider,
    responseFormat:
      responseSchema == null
        ? undefined
        : {
            type: "json_schema",
            jsonSchema: {
              name: "related_note_recommendation_verification_response",
              schema: responseSchema as Json,
              strict: true,
            },
          },
    systemPrompt,
    temperature: configuration.temperature,
    userPrompt,
  });

  await onUsage?.(result.usage);

  let response: unknown;

  try {
    response = JSON.parse(result.content) as unknown;
  } catch (error) {
    await reportRelatedNotesOperationalError({
      error,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.VERIFICATION_RESPONSE_PARSE_FAILED,
      message: "Related Note 추천 검증 응답 JSON 파싱에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.PARSE_VERIFICATION_RESPONSE,
    });

    throw new Error("Related note verification response is not valid JSON.");
  }

  const parsed = relatedNoteVerificationResponseSchema.safeParse(response);

  if (!parsed.success) {
    const error = new Error(
      "Related note verification response does not match the expected schema.",
    );

    await reportRelatedNotesOperationalError({
      error,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.VERIFICATION_RESPONSE_VALIDATION_FAILED,
      message: "Related Note 추천 검증 응답이 예상한 형식과 일치하지 않습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.VALIDATE_VERIFICATION_RESPONSE,
    });

    throw error;
  }

  const verifications = parsed.data.verifications;

  await assertVerificationNoteIdsMatchRecommendations({
    recommendations,
    verifications,
  });

  const verificationsByNoteId = new Map(
    verifications.map((verification) => [verification.noteId, verification]),
  );

  /*
   * Verifier LLM이 JSON 배열을 임의 순서로 반환해도 저장 snapshot의 순위는
   * Answer Agent가 만든 원래 추천 순서를 기준으로 보존합니다.
   */
  const orderedVerifications = recommendations.map((recommendation) => {
    const verification = verificationsByNoteId.get(recommendation.noteId);

    if (!verification) {
      throw new Error(
        "Related note verification note IDs do not match recommendations.",
      );
    }

    return verification;
  });

  return {
    recommendations: recommendations.flatMap((recommendation) => {
      const verification = verificationsByNoteId.get(recommendation.noteId);

      if (!verification?.approved) {
        return [];
      }

      return [
        {
          noteId: recommendation.noteId,
          reason: recommendation.reason,
        },
      ];
    }),
    verifications: orderedVerifications,
    usage: result.usage,
  };
}

/**
 * Verifier가 사용할 추천별 evidence context를 구성합니다.
 *
 * @param params Answer 추천과 Retrieval matched chunks
 * @returns Verifier Prompt에 전달할 추천별 evidence context
 */
function buildRelatedNoteVerificationContext({
  recommendations,
  notes,
}: {
  recommendations: RelatedNoteAiRecommendation[];
  notes: MatchedNote[];
}): string {
  return recommendations
    .map((recommendation) => {
      const matchedChunks = notes.filter(
        (note) => note.id === recommendation.noteId,
      );

      const chunks = matchedChunks
        .map(
          (note) =>
            `<chunk>\n<similarity>${note.similarity}</similarity>\n<content>${note.chunkText}</content>\n</chunk>`,
        )
        .join("\n");

      return `<candidate>\n<note_id>${recommendation.noteId}</note_id>\n<title>${recommendation.title}</title>\n<answer_reason>${recommendation.reason}</answer_reason>\n<matched_chunks>\n${chunks}\n</matched_chunks>\n</candidate>`;
    })
    .join("\n\n");
}

/**
 * 각 Answer 추천에 대응하는 Retrieval matched chunk가 존재하는지 검증합니다.
 *
 * @param params Answer 추천과 Retrieval matched chunks
 */
async function assertRecommendationsHaveEvidence({
  recommendations,
  notes,
}: {
  recommendations: RelatedNoteAiRecommendation[];
  notes: MatchedNote[];
}): Promise<void> {
  const noteIdsWithEvidence = new Set(notes.map((note) => note.id));
  const noteIdsWithoutEvidence = recommendations
    .map((recommendation) => recommendation.noteId)
    .filter((noteId) => !noteIdsWithEvidence.has(noteId));

  if (noteIdsWithoutEvidence.length === 0) {
    return;
  }

  const error = new Error(
    `Related note verification evidence not found: ${noteIdsWithoutEvidence.join(", ")}`,
  );

  await reportRelatedNotesOperationalError({
    error,
    errorCode:
      RELATED_NOTES_OPERATIONAL_ERROR_CODES.VERIFICATIONS_RESOLVE_FAILED,
    message: "Related Note 추천 검증에 필요한 검색 근거를 찾지 못했습니다.",
    operation: RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.RESOLVE_VERIFICATIONS,
    context: {
      noteIds: noteIdsWithoutEvidence,
    },
  });

  throw error;
}

/**
 * Verifier 응답 noteId 집합이 Answer 추천 noteId 집합과 정확히 일치하는지 검증합니다.
 *
 * @param params Answer 추천과 Verifier 판정 결과
 */
async function assertVerificationNoteIdsMatchRecommendations({
  recommendations,
  verifications,
}: {
  recommendations: RelatedNoteAiRecommendation[];
  verifications: RelatedNoteVerification[];
}): Promise<void> {
  const expectedNoteIds = recommendations.map(
    (recommendation) => recommendation.noteId,
  );
  const actualNoteIds = verifications.map(
    (verification) => verification.noteId,
  );
  const actualNoteIdSet = new Set(actualNoteIds);

  const hasDuplicate =
    actualNoteIds.length !== actualNoteIdSet.size ||
    expectedNoteIds.length !== new Set(expectedNoteIds).size;
  const hasMissing = expectedNoteIds.some(
    (noteId) => !actualNoteIdSet.has(noteId),
  );
  const expectedNoteIdSet = new Set(expectedNoteIds);
  const hasUnknown = actualNoteIds.some(
    (noteId) => !expectedNoteIdSet.has(noteId),
  );

  if (!hasDuplicate && !hasMissing && !hasUnknown) {
    return;
  }

  const error = new Error(
    "Related note verification note IDs do not match recommendations.",
  );

  await reportRelatedNotesOperationalError({
    error,
    errorCode:
      RELATED_NOTES_OPERATIONAL_ERROR_CODES.VERIFICATIONS_RESOLVE_FAILED,
    message: "Related Note 추천 검증 결과가 추천 목록과 일치하지 않습니다.",
    operation: RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.RESOLVE_VERIFICATIONS,
    context: {
      actualNoteIds,
      expectedNoteIds,
    },
  });

  throw error;
}
