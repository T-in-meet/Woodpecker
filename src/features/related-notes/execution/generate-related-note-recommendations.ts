import { z } from "zod";

import { renderPromptTemplate } from "@/features/ai/prompts/render";
import { createAiChatCompletionWithProvider } from "@/features/ai/providers";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import type { MatchedNote } from "@/features/ai/rags/note/get-matched-notes";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";
import type { Json } from "@/types/db.helpers";

import type { RelatedNoteRecommendation } from "../types";

// LLM의 원본 JSON 응답 계약입니다.
//
// 현재 Answer Agent는 추천 Note ID를 직접 반환하지 않고, 프롬프트에 제공된
// 검색 Context의 zero-based index 목록만 반환합니다.
//
// LLM 반환 형태를 바꾸는 경우 함께 수정해야 하는 항목:
// 1. 이 Zod schema
// 2. 아래 `parsed.data`를 `RelatedNoteRecommendation[]`으로 변환하는 mapping
// 3. DB에 저장된 related-note recommendation prompt version의 response_schema
// 4. generate-related-note-recommendations.test.ts의 mock 응답/기대값
const relatedNoteRecommendationResponseSchema = z.object({
  usedContextIndexes: z.array(z.number().int().nonnegative()).default([]),
});

type GenerateRelatedNoteRecommendationsParams = {
  /** 관련 노트 추천에 사용할 Answer Agent Runtime Configuration입니다. */
  configuration: AiRuntimeChatConfiguration;

  /** Query Expansion으로 생성된 관련 노트 검색 질문입니다. */
  expandedQuery: string;

  /** 검색된 Note Context입니다. */
  context: string;

  /** LLM이 선택할 수 있는 검색 결과 Note 목록입니다. */
  notes: MatchedNote[];
};

/**
 * 관련 노트 추천 Answer Agent의 응답을 생성하고
 * Context 순번을 실제 Note 추천 항목으로 변환합니다.
 *
 * Answer Agent에는 원본 Note의 제목과 내용이 아니라
 * Query Expansion으로 생성된 검색 질문과 RAG Context를 전달합니다.
 *
 * LLM은 Context의 순번을 반환하고,
 * 애플리케이션이 해당 순번을 실제 Note ID와 제목 snapshot으로 변환합니다.
 *
 * @param params 관련 노트 추천 실행에 필요한 Runtime 설정과 RAG 결과
 * @returns 추천된 관련 Note 목록
 */
export async function generateRelatedNoteRecommendations({
  configuration,
  expandedQuery,
  context,
  notes,
}: GenerateRelatedNoteRecommendationsParams): Promise<
  RelatedNoteRecommendation[]
> {
  const promptVersion = configuration.prompt.version;
  const model = configuration.model;
  const responseSchema = promptVersion.response_schema;

  const templateVariables = {
    context,
    question: expandedQuery,
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
              name: "related_note_recommendation_response",
              schema: responseSchema as Json,
              strict: true,
            },
          },
    systemPrompt,
    temperature: configuration.temperature,
    userPrompt,
  });

  let response: unknown;

  try {
    response = JSON.parse(result.content) as unknown;
  } catch {
    throw new Error("Related note recommendation response is not valid JSON.");
  }

  const parsed = relatedNoteRecommendationResponseSchema.safeParse(response);

  if (!parsed.success) {
    throw new Error(
      "Related note recommendation response does not match the expected schema.",
    );
  }

  // 현재 저장 포맷은 LLM 응답을 그대로 저장하지 않습니다.
  // LLM이 고른 Context index를 서버가 신뢰 가능한 검색 결과 배열에 다시 매핑해
  // `{ noteId, title }` snapshot으로 저장합니다. 향후 추천 이유, 점수, 관계 유형 등
  // 추가 필드를 LLM이 반환하도록 바꾸면 이 mapping에서 필드를 검증/정규화한 뒤
  // `RelatedNoteRecommendation`에 추가하세요.
  return parsed.data.usedContextIndexes.flatMap((index) => {
    const note = notes[index];

    return note
      ? [
          {
            noteId: note.id,
            title: note.title,
          },
        ]
      : [];
  });
}
