import { z } from "zod";

import { renderPromptTemplate } from "@/features/ai/prompts/render";
import { createAiChatCompletionWithProvider } from "@/features/ai/providers";
import { getProviderApiKey } from "@/features/ai/providers/utils/api-key";
import type { MatchedNote } from "@/features/ai/rags/note/get-matched-notes";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";
import type { Json } from "@/types/db.helpers";

import type { RelatedNoteRecommendation } from "../types";

/*
 * LLM의 원본 JSON 응답 계약입니다.
 *
 * 현재 Answer Agent는 추천 Note ID를 직접 반환하지 않고,
 * 프롬프트에 제공된 검색 Context의 1부터 시작하는 index 목록을 반환합니다.
 *
 * buildNoteContext도 검색된 chunk에 [1], [2], ... 형태의 Context 번호를
 * 부여하므로 이 응답 계약 역시 양의 정수만 허용합니다.
 *
 * LLM 반환 형태를 바꾸는 경우 함께 수정해야 하는 항목:
 * 1. 이 Zod schema
 * 2. 아래 `parsed.data`를 `RelatedNoteRecommendation[]`으로 변환하는 mapping
 * 3. DB에 저장된 Related Notes Answer Prompt Version의 response_schema
 * 4. generate-related-note-recommendations.test.ts의 mock 응답/기대값
 */
const relatedNoteRecommendationResponseSchema = z.object({
  usedContextIndexes: z.array(z.number().int().positive()).default([]),
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
   * 배열 순서와 buildNoteContext의 1-based Context 번호가 대응합니다.
   */
  notes: MatchedNote[];
};

/**
 * 관련 노트 추천 Answer Agent의 응답을 생성하고
 * 선택된 chunk Context 순번을 실제 Note 추천 항목으로 변환합니다.
 *
 * Answer Agent에는 원본 Note 전체 내용이 아니라
 * Query Expansion으로 생성된 검색 질문과 실제 검색에 매칭된 chunk Context를
 * 전달합니다.
 *
 * LLM은 1부터 시작하는 Context 번호를 반환하며,
 * 애플리케이션은 해당 번호를 MatchedNote에 다시 매핑합니다.
 *
 * 청킹 이후 서로 다른 Context 번호가 동일한 Note의 chunk를 가리킬 수 있으므로,
 * 최종 추천 결과는 Note ID 기준으로 중복 제거합니다.
 * 이때 LLM이 처음 선택한 순서를 유지합니다.
 *
 * 존재하지 않는 Context 번호가 반환되면 잘못된 Note를 조용히 누락시키지 않고
 * Answer Agent 응답 계약 위반으로 간주하여 실행을 중단합니다.
 *
 * @param params 관련 노트 추천 실행에 필요한 Runtime 설정과 RAG 결과
 * @returns LLM이 선택한 순서를 유지한 중복 없는 관련 Note 목록
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

  /*
   * 현재 저장 포맷은 LLM 응답을 그대로 저장하지 않습니다.
   *
   * LLM이 선택한 1-based Context index를 서버가 신뢰 가능한 MatchedNote 배열에
   * 다시 매핑하고 `{ noteId, title }` snapshot으로 정규화합니다.
   *
   * 하나의 Note에서 여러 관련 chunk가 검색될 수 있으므로,
   * 서로 다른 Context index가 동일 Note ID를 가리키는 경우
   * 첫 번째 선택만 유지하여 Note 단위 추천이 중복 저장되지 않도록 합니다.
   *
   * 향후 추천 이유, 점수, 관계 유형 등의 필드를 LLM이 반환하도록 바꾸면
   * 이 변환 단계에서 필드를 검증/정규화한 뒤
   * RelatedNoteRecommendation에 추가해야 합니다.
   */
  const recommendations: RelatedNoteRecommendation[] = [];
  const recommendedNoteIds = new Set<string>();

  for (const contextIndex of parsed.data.usedContextIndexes) {
    /*
     * buildNoteContext는 [1]부터 번호를 부여하지만
     * JavaScript 배열은 0부터 시작하므로 1을 빼서 매핑합니다.
     */
    const note = notes[contextIndex - 1];

    if (!note) {
      throw new Error(
        `Related note recommendation context index not found: ${contextIndex}`,
      );
    }

    /*
     * 동일 Note의 여러 chunk가 선택된 경우에도
     * 최종 Related Notes 추천에는 해당 Note를 한 번만 포함합니다.
     */
    if (recommendedNoteIds.has(note.id)) {
      continue;
    }

    recommendedNoteIds.add(note.id);

    recommendations.push({
      noteId: note.id,
      title: note.title,
    });
  }

  return recommendations;
}
