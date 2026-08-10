import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";
import type { AiProviderChatMessage } from "@/features/ai/providers/types";
import type {
  AiRuntimeChatConfiguration,
  AiRuntimeEmbeddingConfiguration,
} from "@/features/ai/runtimes/types";
import {
  NOTE_CHAT_OPERATIONAL_ERROR_CODES,
  NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS,
  NOTE_CHAT_OPERATIONAL_ERROR_STAGES,
} from "@/features/operational-errors/constants";
import type { Json } from "@/types/db.helpers";

import { NOTE_CHAT_CONTEXT_LIMIT } from "../constants/execution";
import { getNoteChatConversationDetail } from "../queries";
import type { NoteChatConversation } from "../types";
import { reportNoteChatOperationalError } from "../utils/report-operational-error";
import { buildNoteChatContext } from "./build-note-context";
import { buildNoteChatSources } from "./build-note-sources";
import { expandNoteChatQuery } from "./expand-query";
import { getMatchedNoteChatNotes } from "./get-matched-notes";
import { resolveNoteChatExecutionMessages } from "./resolve-execution-messages";
import { searchNoteChatEmbeddings } from "./search-note-embeddings";

/**
 * 노트 챗봇 한 번의 실행에서 확정된 AI Runtime 설정입니다.
 */
export type NoteChatExecutionSettings = {
  /** 답변 생성에 사용할 Chat Runtime Configuration입니다. */
  chat: AiRuntimeChatConfiguration;

  /** 문맥 기반 질의 확장에 사용할 Chat Runtime Configuration입니다. */
  queryExpansion: AiRuntimeChatConfiguration;

  /** 노트 검색에 사용할 Embedding Runtime Configuration입니다. */
  embedding: AiRuntimeEmbeddingConfiguration;
};

/**
 * Provider 스트리밍 호출 직전에 확정된 노트 챗봇 실행 정보입니다.
 */
export type PreparedNoteChatExecution = {
  /** 실행 대상 대화입니다. */
  conversation: NoteChatConversation;

  /** 문맥 기반 질의 확장을 통해 생성된 노트 검색용 질의입니다. */
  expandedQuery: string;

  /** Provider에 전달할 System·대화 이력·현재 질문 메시지입니다. */
  messages: AiProviderChatMessage[];

  /** AI Foundation Runtime에서 확정된 실행 설정입니다. */
  settings: NoteChatExecutionSettings;

  /** 실행 과정에서 LLM Context에 주입한 Note Source Snapshot입니다. */
  sources: Json[];

  /** 현재 실행을 발생시킨 사용자 메시지 ID입니다. */
  userMessageId: string;
};

type PrepareNoteChatExecutionParams = {
  /** 실행할 대화 ID입니다. */
  conversationId: string;

  /** Route에서 확정된 AI Runtime 설정입니다. */
  settings: NoteChatExecutionSettings;

  /** 현재 실행을 발생시킨 사용자 메시지 ID입니다. */
  userMessageId: string;
};

/**
 * 노트 챗봇 Provider 스트리밍 호출에 필요한 데이터를 준비합니다.
 *
 * 다음 작업을 수행합니다.
 *
 * 1. 현재 사용자가 접근할 수 있는 대화와 전체 메시지를 조회합니다.
 * 2. 현재 사용자 메시지에서 질문을 추출합니다.
 * 3. 이전 대화 이력을 바탕으로 문맥 기반 검색 질의를 확장합니다.
 * 4. Runtime Embedding Model로 확장 질의 Embedding을 생성합니다.
 * 5. 현재 사용자의 유사한 Note Embedding을 검색합니다.
 * 6. 검색된 Embedding에 해당하는 실제 노트를 조회합니다.
 * 7. 검색된 노트로 Prompt Context와 Source Snapshot을 구성합니다.
 * 8. Runtime Prompt Template에 원본 question과 context를 전달하여
 *    Provider 메시지를 생성합니다.
 *
 * 실제 답변에서 참고한 Note ID는 이 단계에서 결정하지 않습니다.
 * LLM 응답의 참고 Context 순번을 응답 처리 단계에서 Source와 매핑하여
 * usedNoteIds를 확정합니다.
 *
 * @param params 대화, 사용자 메시지 및 확정된 Runtime 설정
 * @returns Provider 호출 직전에 확정된 실행 정보
 */
export async function prepareNoteChatExecution(
  params: PrepareNoteChatExecutionParams,
): Promise<PreparedNoteChatExecution> {
  const detail = await getNoteChatConversationDetail(params.conversationId);

  if (!detail) {
    const error = new Error(
      `Note chat conversation not found: ${params.conversationId}`,
    );

    /*
     * DB 조회 자체는 정상적으로 완료됐지만 실행 대상 Conversation을
     * 확인할 수 없는 경우이므로 DB 장애가 아닌 실행 상태 오류로 보고합니다.
     */
    await reportNoteChatOperationalError({
      context: {
        conversationId: params.conversationId,
        userMessageId: params.userMessageId,
      },
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.EXECUTION_STATE_INVALID,
      message: "노트 챗봇 실행 대상 대화를 확인하지 못했습니다.",
      operation:
        NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.VALIDATE_EXECUTION_STATE,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.EXECUTION,
    });

    throw error;
  }

  /*
   * 이번 실행을 발생시킨 메시지를 전체 대화에서 찾습니다.
   *
   * 이후 질의 확장과 최종 답변 생성은 userMessageId를 기준으로
   * 각 단계에서 현재 질문을 추출하므로,
   * 여기서는 실행 대상 메시지가 실제로 존재하고 User 역할인지 검증합니다.
   */
  const currentUserMessage = detail.messages.find(
    (message) => message.id === params.userMessageId,
  );

  if (!currentUserMessage) {
    const error = new Error(
      `Note chat user message not found: ${params.userMessageId}`,
    );

    /*
     * Conversation은 정상적으로 조회됐지만 현재 실행을 발생시킨
     * User Message가 대화 이력에 없으면 실행 상태가 일관되지 않은 것입니다.
     */
    await reportNoteChatOperationalError({
      actorUserId: detail.conversation.user_id,
      context: {
        conversationId: params.conversationId,
        userMessageId: params.userMessageId,
      },
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.EXECUTION_STATE_INVALID,
      message: "노트 챗봇 실행 대상 사용자 메시지를 확인하지 못했습니다.",
      operation:
        NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.VALIDATE_EXECUTION_STATE,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.EXECUTION,
      userId: detail.conversation.user_id,
    });

    throw error;
  }

  if (currentUserMessage.role !== AI_CHAT_MESSAGE_ROLE.USER) {
    const error = new Error(
      `Note chat execution message is not a user message: ${params.userMessageId}`,
    );

    /*
     * 실행 대상 메시지는 반드시 User 역할이어야 하므로 다른 역할이 확인되면
     * 이후 질의 확장이나 답변 생성을 진행하지 않고 실행 상태 오류로 보고합니다.
     */
    await reportNoteChatOperationalError({
      actorUserId: detail.conversation.user_id,
      context: {
        conversationId: params.conversationId,
        userMessageId: params.userMessageId,
      },
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.EXECUTION_STATE_INVALID,
      message: "노트 챗봇 실행 대상 메시지 역할이 올바르지 않습니다.",
      operation:
        NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.VALIDATE_EXECUTION_STATE,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.EXECUTION,
      userId: detail.conversation.user_id,
    });

    throw error;
  }

  /*
   * 현재 사용자 질문과 이전 대화 이력을 바탕으로
   * 노트 검색에 사용할 문맥 기반 확장 질의를 생성합니다.
   *
   * 확장 질의는 검색 단계에서만 사용하며,
   * 실제 사용자 질문과 최종 답변용 Conversation Message는 변경하지 않습니다.
   */
  const expandedQuery = await expandNoteChatQuery({
    configuration: params.settings.queryExpansion,
    messages: detail.messages,
    userMessageId: params.userMessageId,
  });

  /*
   * 원본 사용자 질문이 아니라 문맥 기반으로 확장된 검색 질의를 Embedding하여
   * 현재 대화 문맥을 반영한 노트 후보를 검색합니다.
   */
  const embeddingMatches = await searchNoteChatEmbeddings({
    embeddingConfiguration: params.settings.embedding,
    ownerUserId: detail.conversation.user_id,
    question: expandedQuery,
  });

  const matchedNotes = await getMatchedNoteChatNotes({
    matches: embeddingMatches,
    ownerUserId: detail.conversation.user_id,
  });

  /*
   * 검색 후보 중 유사도가 높은 순서대로
   * 실제 Prompt Context에 사용할 노트만 선택합니다.
   */
  const contextNotes = matchedNotes.slice(0, NOTE_CHAT_CONTEXT_LIMIT);

  // TODO: 검색된 노트가 없는 경우 Chat Provider를 호출하지 않고,
  // 서버에서 고정된 안내 답변을 생성하여 Run을 성공 처리하는 경로를 추가한다.
  // 불필요한 LLM 호출과 토큰 사용을 방지하고,
  // Context 없이 일반 지식으로 답변하는 동작도 차단한다.

  const context = buildNoteChatContext({
    notes: contextNotes,
  });

  const sources = buildNoteChatSources(contextNotes);

  let messages: AiProviderChatMessage[];

  try {
    messages = resolveNoteChatExecutionMessages({
      context,
      messages: detail.messages,
      systemTemplate: params.settings.chat.prompt.version.system_template,
      userMessageId: params.userMessageId,
      userTemplate: params.settings.chat.prompt.version.user_template,
    });
  } catch (error) {
    /*
     * DB 메시지를 Provider 실행 메시지로 변환하는 과정에서
     * 저장된 content 구조나 message role 등 Note Chat 메시지 계약이
     * 깨진 상태가 확인되면 실행을 중단하고 운영 오류로 보고합니다.
     *
     * 실제 메시지 본문은 운영 오류 Context에 저장하지 않습니다.
     */
    await reportNoteChatOperationalError({
      actorUserId: detail.conversation.user_id,
      context: {
        conversationId: params.conversationId,
        userMessageId: params.userMessageId,
      },
      error,
      errorCode:
        NOTE_CHAT_OPERATIONAL_ERROR_CODES.EXECUTION_MESSAGES_RESOLVE_FAILED,
      message: "노트 챗봇 실행 메시지 구성에 실패했습니다.",
      operation:
        NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.RESOLVE_EXECUTION_MESSAGES,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.EXECUTION,
      userId: detail.conversation.user_id,
    });

    throw error;
  }

  return {
    conversation: detail.conversation,
    expandedQuery,
    messages,
    settings: params.settings,
    sources,
    userMessageId: params.userMessageId,
  };
}
