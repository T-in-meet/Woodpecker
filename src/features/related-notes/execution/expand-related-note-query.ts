import { z } from "zod";

import { createQueryExpansionCompletion } from "@/features/ai/rags/query-expansion/create-query-expansion-completion";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";

const relatedNoteQueryExpansionResponseSchema = z.object({
  expandedQuery: z.string().trim().min(1),
});

type ExpandRelatedNoteQueryParams = {
  /** 관련 노트 검색 질문 생성에 사용할 Chat Runtime Configuration입니다. */
  configuration: AiRuntimeChatConfiguration;

  /** 관련 노트를 추천할 대상 노트의 제목입니다. */
  title: string;

  /** 관련 노트를 추천할 대상 노트의 내용입니다. */
  content: string;
};

/**
 * 현재 노트의 제목과 내용을 바탕으로 관련 노트 검색에 사용할 질의를 생성합니다.
 *
 * 질의 확장 자체는 공통 Query Expansion 실행기를 사용하고,
 * 관련 노트 추천에 필요한 입력과 응답 검증만 이 기능에서 담당합니다.
 *
 * @param params 대상 노트와 Query Expansion Runtime 설정
 * @returns 관련 노트 검색에 사용할 확장 질의
 */
export async function expandRelatedNoteQuery(
  params: ExpandRelatedNoteQueryParams,
): Promise<string> {
  const result = await createQueryExpansionCompletion({
    configuration: params.configuration,
    responseSchemaName: "related_note_query_expansion_response",
    variables: {
      title: params.title,
      content: params.content,
    },
  });

  let response: unknown;

  try {
    response = JSON.parse(result.content) as unknown;
  } catch {
    throw new Error("Related note query expansion response is not valid JSON.");
  }

  const parsed = relatedNoteQueryExpansionResponseSchema.safeParse(response);

  if (!parsed.success) {
    throw new Error(
      "Related note query expansion response does not match the expected schema.",
    );
  }

  return parsed.data.expandedQuery;
}
