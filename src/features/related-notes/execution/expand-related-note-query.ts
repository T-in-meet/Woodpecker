import { z } from "zod";

import { createQueryExpansionCompletion } from "@/features/ai/rags/query-expansion/create-query-expansion-completion";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";
import {
  RELATED_NOTES_OPERATIONAL_ERROR_CODES,
  RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";

import { reportRelatedNotesOperationalError } from "../utils/report-operational-error";

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

  // Provider가 반환한 문자열 응답을 JSON 값으로 변환합니다.
  try {
    response = JSON.parse(result.content) as unknown;
  } catch (error) {
    await reportRelatedNotesOperationalError({
      error,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.QUERY_EXPANSION_RESPONSE_PARSE_FAILED,
      message: "Related Note 검색 질의 확장 응답 JSON 파싱에 실패했습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.PARSE_QUERY_EXPANSION_RESPONSE,
      context: {
        title: params.title,
      },
    });

    throw new Error("Related note query expansion response is not valid JSON.");
  }

  // 파싱된 응답이 Related Notes Query Expansion 응답 계약을 만족하는지 검증합니다.
  const parsed = relatedNoteQueryExpansionResponseSchema.safeParse(response);

  if (!parsed.success) {
    const error = new Error(
      "Related note query expansion response does not match the expected schema.",
    );

    await reportRelatedNotesOperationalError({
      error,
      errorCode:
        RELATED_NOTES_OPERATIONAL_ERROR_CODES.QUERY_EXPANSION_RESPONSE_VALIDATION_FAILED,
      message:
        "Related Note 검색 질의 확장 응답이 예상한 형식과 일치하지 않습니다.",
      operation:
        RELATED_NOTES_OPERATIONAL_ERROR_OPERATIONS.VALIDATE_QUERY_EXPANSION_RESPONSE,
      context: {
        title: params.title,
      },
    });

    throw error;
  }

  return parsed.data.expandedQuery;
}
