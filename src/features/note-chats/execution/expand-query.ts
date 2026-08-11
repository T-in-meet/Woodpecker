import { z } from "zod";

import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";
import type { AiProviderChatMessage } from "@/features/ai/providers/types";
import { createQueryExpansionCompletion } from "@/features/ai/rags/query-expansion/create-query-expansion-completion";
import type { AiRuntimeChatConfiguration } from "@/features/ai/runtimes/types";
import {
  NOTE_CHAT_OPERATIONAL_ERROR_CODES,
  NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS,
  NOTE_CHAT_OPERATIONAL_ERROR_STAGES,
} from "@/features/operational-errors/constants";

import {
  NOTE_CHAT_HISTORY_CHAR_LIMIT,
  NOTE_CHAT_HISTORY_MESSAGE_LIMIT,
} from "../constants/execution";
import { noteChatUserMessageContentSchema } from "../schema";
import type { NoteChatMessage } from "../types";
import { reportNoteChatOperationalError } from "../utils/report-operational-error";
import { resolveNoteChatProviderMessages } from "./resolve-messages";

const noteChatQueryExpansionResponseSchema = z.object({
  expandedQuery: z.string().trim().min(1),
});

type ExpandNoteChatQueryParams = {
  /** 문맥 기반 질의 확장에 사용할 Chat Runtime Configuration입니다. */
  configuration: AiRuntimeChatConfiguration;

  /** 대화 순서대로 정렬된 전체 메시지입니다. */
  messages: NoteChatMessage[];

  /** 현재 실행을 발생시킨 사용자 메시지 ID입니다. */
  userMessageId: string;
};

/**
 * 문맥 기반 질의 확장에 전달할 이전 대화 이력을 실행 정책 범위로 제한합니다.
 *
 * 최근 메시지를 최대 `NOTE_CHAT_HISTORY_MESSAGE_LIMIT`개까지 대상으로 삼고,
 * 최신 메시지부터 본문 문자 수를 합산하여
 * `NOTE_CHAT_HISTORY_CHAR_LIMIT`을 초과하지 않는 범위만 유지합니다.
 *
 * @param messages Provider 메시지 형식으로 변환된 이전 대화 이력
 * @returns 메시지 개수와 문자 수 제한이 적용된 이전 대화 이력
 */
function limitNoteChatQueryExpansionHistory(
  messages: AiProviderChatMessage[],
): AiProviderChatMessage[] {
  const recentMessages = messages.slice(-NOTE_CHAT_HISTORY_MESSAGE_LIMIT);

  const limitedMessages: AiProviderChatMessage[] = [];
  let totalCharacters = 0;

  /*
   * 가장 최근 대화부터 포함 여부를 판단합니다.
   *
   * 오래된 메시지 때문에 최신 문맥이 제외되지 않도록
   * 역순으로 문자 수를 계산한 뒤 마지막에 원래 대화 순서로 복원합니다.
   */
  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const message = recentMessages[index];

    if (!message) {
      continue;
    }

    const nextTotalCharacters = totalCharacters + message.content.length;

    if (nextTotalCharacters > NOTE_CHAT_HISTORY_CHAR_LIMIT) {
      break;
    }

    limitedMessages.push(message);
    totalCharacters = nextTotalCharacters;
  }

  return limitedMessages.reverse();
}

/**
 * Provider 메시지 형식의 대화 이력을 Prompt Template에 전달할 문자열로 변환합니다.
 *
 * 질의 확장 Provider 호출은 `systemPrompt`와 `userPrompt` 기반의
 * 비스트리밍 Chat API를 사용하므로 이전 대화 이력을 User Prompt 안에
 * 명시적인 role과 content 형태로 직렬화합니다.
 *
 * @param messages 대화 순서대로 정렬된 이전 Provider 메시지
 * @returns 질의 확장 Prompt의 `messages` 변수에 사용할 문자열
 */
function serializeNoteChatQueryExpansionHistory(
  messages: AiProviderChatMessage[],
): string {
  if (messages.length === 0) {
    return "(이전 대화 없음)";
  }

  return messages
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");
}

/**
 * 현재 사용자 질문과 이전 대화 이력을 바탕으로
 * 노트 검색에 사용할 문맥 기반 확장 질의를 생성합니다.
 *
 * 검색된 Note Context는 사용하지 않습니다.
 * 현재 질문보다 앞선 Conversation Message만 질의 확장의 문맥으로 사용합니다.
 *
 * Runtime Prompt Version의 `system_template`, `user_template`,
 * `response_schema`를 사용하며 Provider 응답은 애플리케이션 스키마로
 * 다시 검증한 뒤 `expandedQuery`만 반환합니다.
 *
 * @param params 전체 대화 메시지, 현재 사용자 메시지 및 질의 확장 Runtime 설정
 * @returns Embedding 검색에 사용할 문맥 기반 확장 질의
 */
export async function expandNoteChatQuery(
  params: ExpandNoteChatQueryParams,
): Promise<string> {
  const currentUserMessage = params.messages.find(
    (message) => message.id === params.userMessageId,
  );

  if (!currentUserMessage) {
    throw new Error(
      `Note chat user message not found: ${params.userMessageId}`,
    );
  }

  if (currentUserMessage.role !== AI_CHAT_MESSAGE_ROLE.USER) {
    throw new Error(
      `Note chat execution message is not a user message: ${params.userMessageId}`,
    );
  }

  /*
   * DB의 JSON content를 사용자 메시지 스키마로 검증한 뒤
   * 질의 확장의 대상이 되는 현재 질문 문자열을 추출합니다.
   */
  const currentContent = noteChatUserMessageContentSchema.parse(
    currentUserMessage.content,
  );

  /*
   * 현재 질문 이후의 메시지는 질의 확장 문맥에 포함하지 않습니다.
   *
   * 특히 기존 질문 수정 후 재실행되는 경우에도 sequence_number를 기준으로
   * 현재 질문 시점 이전의 대화만 사용하도록 경계를 명확히 유지합니다.
   */
  const historyMessages = params.messages.filter(
    (message) => message.sequence_number < currentUserMessage.sequence_number,
  );

  /*
   * DB Message의 role과 JSON content를 직접 Provider 입력으로 사용하지 않고,
   * 기존 Note Chat 메시지 변환 경로를 거쳐 검증된 Provider 메시지로 변환합니다.
   */
  const providerHistoryMessages =
    resolveNoteChatProviderMessages(historyMessages);

  /*
   * 최종 답변 생성과 동일한 대화 이력 제한 정책을 적용합니다.
   * DB의 전체 Conversation Message 자체를 변경하지는 않습니다.
   */
  const limitedHistoryMessages = limitNoteChatQueryExpansionHistory(
    providerHistoryMessages,
  );

  const serializedMessages = serializeNoteChatQueryExpansionHistory(
    limitedHistoryMessages,
  );

  /*
   * Prompt Template과 Provider 호출은 공통 RAG Query Expansion 실행기에 위임합니다.
   *
   * Note Chat은 대화 이력과 현재 질문을 Prompt 변수로 구성하지만,
   * 실제 Chat Completion 실행 자체는 Note Chat에 종속되지 않습니다.
   */
  const result = await createQueryExpansionCompletion({
    configuration: params.configuration,
    responseSchemaName: "note_chat_query_expansion_response",
    variables: {
      messages: serializedMessages,
      question: currentContent.text,
    },
  });

  /*
   * Provider의 구조화 응답을 그대로 신뢰하지 않고
   * JSON 파싱 후 Note Chat 애플리케이션 스키마로 다시 검증합니다.
   *
   * 질의 확장 실패를 원본 질문 검색으로 숨기지 않고 실행 오류로 전파합니다.
   */
  let response: unknown;

  try {
    response = JSON.parse(result.content) as unknown;
  } catch {
    const error = new Error(
      "Note chat query expansion response is not valid JSON.",
    );

    /*
     * Provider 호출은 정상적으로 완료됐지만 질의 확장 결과가
     * Note Chat이 요구하는 JSON 계약을 만족하지 못한 경우입니다.
     *
     * Provider 응답 원문이나 사용자 질문은 운영 오류에 저장하지 않고,
     * 실행 대상 User Message만 식별 정보로 기록합니다.
     */
    await reportNoteChatOperationalError({
      context: {
        userMessageId: params.userMessageId,
      },
      error,
      errorCode:
        NOTE_CHAT_OPERATIONAL_ERROR_CODES.QUERY_EXPANSION_RESPONSE_PARSE_FAILED,
      message: "노트 챗봇 질의 확장 응답 JSON 파싱에 실패했습니다.",
      operation:
        NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.PARSE_QUERY_EXPANSION_RESPONSE,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.EXECUTION,
    });

    throw error;
  }

  const parsed = noteChatQueryExpansionResponseSchema.safeParse(response);

  if (!parsed.success) {
    const error = new Error(
      "Note chat query expansion response does not match the expected schema.",
    );

    /*
     * JSON 자체는 유효하지만 expandedQuery 계약을 충족하지 못하면
     * 검색 질의를 신뢰할 수 없으므로 실행을 중단하고 운영 오류로 보고합니다.
     *
     * 응답 전체와 Zod 검증 데이터는 기록하지 않아 AI 출력 및 사용자 관련
     * 텍스트가 운영 오류 Context에 복제되지 않도록 합니다.
     */
    await reportNoteChatOperationalError({
      context: {
        userMessageId: params.userMessageId,
      },
      error,
      errorCode:
        NOTE_CHAT_OPERATIONAL_ERROR_CODES.QUERY_EXPANSION_RESPONSE_PARSE_FAILED,
      message: "노트 챗봇 질의 확장 응답 구조 검증에 실패했습니다.",
      operation:
        NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.PARSE_QUERY_EXPANSION_RESPONSE,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.EXECUTION,
    });

    throw error;
  }

  return parsed.data.expandedQuery;
}
