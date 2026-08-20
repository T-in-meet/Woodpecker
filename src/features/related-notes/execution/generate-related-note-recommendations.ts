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

import type { RelatedNoteAiRecommendation } from "../types";
import { reportRelatedNotesOperationalError } from "../utils/report-operational-error";

/*
 * LLM의 원본 JSON 응답 계약입니다.
 *
 * Answer Agent는 프롬프트에 제공된 Related Notes Context의 Note ID와
 * 해당 Note를 추천하는 이유를 반환합니다.
 *
 * Note ID는 UUID 형식이어야 하며,
 * 추천 이유는 비어 있지 않은 문자열만 허용합니다.
 *
 * LLM 반환 형태를 바꾸는 경우 함께 수정해야 하는 항목:
 * 1. 이 Zod schema
 * 2. 아래 `parsed.data`를 `RelatedNoteAiRecommendation[]`으로 변환하는 mapping
 * 3. DB에 저장된 Related Notes Answer Prompt Version의 response_schema
 * 4. generate-related-note-recommendations.test.ts의 mock 응답/기대값
 */
const relatedNoteRecommendationResponseSchema = z.object({
  recommendations: z
    .array(
      z.object({
        noteId: z.string().uuid(),
        reason: z.string().trim().min(1),
      }),
    )
    .default([]),
});

type GenerateRelatedNoteRecommendationsParams = {
  /** 관련 노트 추천에 사용할 Answer Agent Runtime Configuration입니다. */
  configuration: AiRuntimeChatConfiguration;

  /** Query Expansion으로 생성된 관련 노트 검색 질문입니다. */
  expandedQuery: string;

  /** 검색된 Note chunk Context입니다. */
  context: string;

  /**
   * LLM에게 Context로 제공된 검색 결과 chunk 목록입니다.
   *
   * 청킹 도입 이후 하나의 Note에서 여러 MatchedNote가 존재할 수 있으며,
   * 같은 Note에서 검색된 여러 chunk는 동일한 Note ID를 가집니다.
   */
  notes: MatchedNote[];

  /**
   * Provider 응답 직후 Token usage를 저장하기 위한 callback입니다.
   *
   * 응답 파싱이나 추천 Note resolve가 실패하더라도 완료된 Answer Generation
   * 호출의 usage를 Run에 남기기 위해 검증 전에 호출합니다.
   */
  onUsage?: (usage: AiTokenUsage) => Promise<void>;
};

/**
 * Related Notes Answer Generation 실행 결과입니다.
 */
export type GenerateRelatedNoteRecommendationsResult = {
  /** LLM이 선택한 순서를 유지한 중복 없는 AI 관련 Note 추천 목록입니다. */
  recommendations: RelatedNoteAiRecommendation[];

  /** Answer Generation Provider 호출에서 반환된 Token 사용량입니다. */
  usage: AiTokenUsage;
};

/**
 * 관련 노트 추천 Answer Agent의 응답을 생성하고
 * 선택된 Note ID를 실제 AI Note 추천 항목으로 변환합니다.
 *
 * Answer Agent에는 원본 Note 전체 내용이 아니라
 * Query Expansion으로 생성된 검색 질문과 실제 검색에 매칭된 chunk Context를
 * 전달합니다.
 *
 * LLM은 Context에 포함된 Note ID와 추천 이유를 반환하며,
 * 애플리케이션은 반환된 Note ID가 실제 검색 결과에 존재하는지 다시 검증합니다.
 *
 * 청킹 이후 동일한 Note ID를 가진 여러 chunk가 Context에 존재할 수 있으므로,
 * 최종 추천 결과는 Note ID 기준으로 중복 제거합니다.
 * 이때 LLM이 처음 선택한 추천과 이유를 유지합니다.
 *
 * 검색 결과에 존재하지 않는 Note ID가 반환되면 잘못된 Note를 조용히 누락시키지 않고
 * Answer Agent 응답 계약 위반으로 간주하여 실행을 중단합니다.
 *
 * 이 단계에서는 관계의 origin을 결정하지 않습니다.
 * 생성된 추천은 저장 계층에서 AI 추천으로 저장됩니다.
 *
 * @param params 관련 노트 추천 실행에 필요한 Runtime 설정과 RAG 결과
 * @returns 추천 목록과 Provider usage
 */
export async function generateRelatedNoteRecommendations({
  configuration,
  expandedQuery,
  context,
  notes,
  onUsage,
}: GenerateRelatedNoteRecommendationsParams): Promise<GenerateRelatedNoteRecommendationsResult> {
  // Answer Agent 실행에 사용할 Prompt와 Model 설정을 가져옵니다.
  const promptVersion = configuration.prompt.version;
  const model = configuration.model;
  const responseSchema = promptVersion.response_schema;

  // 검색 질문과 RAG Context를 Prompt template 변수로 구성합니다.
  const templateVariables = {
    context,
    question: expandedQuery,
  };

  // 저장된 Prompt template에 현재 추천 실행의 입력값을 적용합니다.
  // Related Notes Answer Agent의 역할과 응답 규칙을 정의하는 System Prompt를 생성합니다.
  const systemPrompt = renderPromptTemplate(
    promptVersion.system_template,
    templateVariables,
  );

  // 검색 질문과 RAG Context를 전달하는 User Prompt를 생성합니다.
  const userPrompt = renderPromptTemplate(
    promptVersion.user_template,
    templateVariables,
  );

  // Answer Agent를 호출하여 관련 Note ID와 추천 이유를 생성합니다.
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
              name: "related_note_recommendation_response",
              schema: responseSchema as Json,
              strict: true,
            },
          },
    systemPrompt,
    temperature: configuration.temperature,
    userPrompt,
  });

  await onUsage?.(result.usage);

  // Provider가 반환한 문자열 응답을 검증 가능한 JSON 값으로 변환합니다.
  let response: unknown;

  try {
    response = JSON.parse(result.content) as unknown;
  } catch (error) {
    await reportRelatedNotesOperationalError({
      error,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_RESPONSE_PARSE_FAILED,
      message: "Related Note 추천 응답 JSON 파싱에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.PARSE_RECOMMENDATION_RESPONSE,
      context: {
        expandedQuery,
      },
    });

    throw new Error("Related note recommendation response is not valid JSON.");
  }

  // 파싱된 응답이 Related Notes Answer Agent의 응답 계약을 만족하는지 검증합니다.
  const parsed = relatedNoteRecommendationResponseSchema.safeParse(response);

  if (!parsed.success) {
    const error = new Error(
      "Related note recommendation response does not match the expected schema.",
    );

    await reportRelatedNotesOperationalError({
      error,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATION_RESPONSE_VALIDATION_FAILED,
      message: "Related Note 추천 응답이 예상한 형식과 일치하지 않습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.VALIDATE_RECOMMENDATION_RESPONSE,
      context: {
        expandedQuery,
      },
    });

    throw error;
  }

  /*
   * LLM 응답을 그대로 저장하지 않습니다.
   *
   * LLM이 반환한 Note ID를 서버가 신뢰 가능한 MatchedNote 목록에
   * 다시 매핑하고 `{ noteId, title, reason }` 형태의 AI 추천 결과로 정규화합니다.
   *
   * 하나의 Note에서 여러 관련 chunk가 검색될 수 있으므로,
   * LLM이 동일한 Note ID를 여러 번 반환하는 경우
   * 첫 번째 선택과 추천 이유만 유지하여 Note 단위 추천이 중복 저장되지 않도록 합니다.
   *
   * origin은 화면 조회 결과에 필요한 관계 정보이며,
   * 이 생성 단계에서는 포함하지 않습니다.
   */
  const recommendations: RelatedNoteAiRecommendation[] = [];
  const recommendedNoteIds = new Set<string>();

  /*
   * 동일 Note에서 여러 chunk가 검색된 경우에도 모두 같은 Note ID를 가지므로,
   * Note ID를 기준으로 검색 결과를 빠르게 확인할 수 있도록 Map을 구성합니다.
   *
   * 동일 Note ID가 여러 번 등장하는 경우 첫 번째 MatchedNote를 유지합니다.
   * 최종 추천에 필요한 title은 Note 단위로 동일한 snapshot을 사용하므로
   * 어느 chunk에서 가져오더라도 동일한 Note를 가리킵니다.
   */
  const matchedNotesById = new Map<string, MatchedNote>();

  for (const note of notes) {
    if (!matchedNotesById.has(note.id)) {
      matchedNotesById.set(note.id, note);
    }
  }

  // LLM이 선택한 추천을 순서대로 실제 Note 추천으로 변환합니다.
  for (const recommendation of parsed.data.recommendations) {
    /*
     * LLM이 반환한 Note ID를 그대로 신뢰하지 않고,
     * 실제 RAG 검색 결과에 포함된 Note인지 서버에서 다시 확인합니다.
     */
    const note = matchedNotesById.get(recommendation.noteId);

    if (!note) {
      const error = new Error(
        `Related note recommendation note ID not found: ${recommendation.noteId}`,
      );

      await reportRelatedNotesOperationalError({
        error,
        errorCode:
          RELATED_NOTES_OPERATIONAL_ERROR_CODES.RECOMMENDATIONS_RESOLVE_FAILED,
        message: "Related Note 추천 결과에 해당하는 Note를 찾지 못했습니다.",
        operation:
          RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.RESOLVE_RECOMMENDATIONS,
        context: {
          expandedQuery,
          noteId: recommendation.noteId,
        },
      });

      throw error;
    }

    /*
     * 동일 Note ID가 여러 번 반환된 경우에도
     * 최종 Related Notes 추천에는 해당 Note를 한 번만 포함합니다.
     */
    if (recommendedNoteIds.has(note.id)) {
      continue;
    }

    // 중복 확인을 통과한 Note를 이후 추천에서 다시 추가하지 않도록 기록합니다.
    recommendedNoteIds.add(note.id);

    // 선택된 Note와 추천 이유를 최종 AI Related Note 추천 항목으로 추가합니다.
    recommendations.push({
      noteId: note.id,
      reason: recommendation.reason,
      title: note.title,
    });
  }

  return {
    recommendations,
    usage: result.usage,
  };
}
