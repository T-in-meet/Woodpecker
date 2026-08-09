import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";
import type { AiProviderChatMessage } from "@/features/ai/providers/types";
import type {
  AiRuntimeChatConfiguration,
  AiRuntimeEmbeddingConfiguration,
} from "@/features/ai/runtimes/types";
import type { Json } from "@/types/db.helpers";

import { getNoteChatConversationDetail } from "../queries";
import { noteChatUserMessageContentSchema } from "../schema";
import type { NoteChatConversation } from "../types";
import { buildNoteChatContext } from "./build-note-context";
import { buildNoteChatSources } from "./build-note-sources";
import { getMatchedNoteChatNotes } from "./get-matched-notes";
import { resolveNoteChatExecutionMessages } from "./resolve-execution-messages";
import { searchNoteChatEmbeddings } from "./search-note-embeddings";

/**
 * 노트 챗봇 한 번의 실행에서 확정된 AI Runtime 설정입니다.
 */
export type NoteChatExecutionSettings = {
  /** 답변 생성에 사용할 Chat Runtime Configuration입니다. */
  chat: AiRuntimeChatConfiguration;

  /** 노트 검색에 사용할 Embedding Runtime Configuration입니다. */
  embedding: AiRuntimeEmbeddingConfiguration;
};

/**
 * Provider 스트리밍 호출 직전에 확정된 노트 챗봇 실행 정보입니다.
 */
export type PreparedNoteChatExecution = {
  /** 실행 대상 대화입니다. */
  conversation: NoteChatConversation;

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
 * 3. Runtime Embedding Model로 질문 Embedding을 생성합니다.
 * 4. 현재 사용자의 유사한 Note Embedding을 검색합니다.
 * 5. 검색된 Embedding에 해당하는 실제 노트를 조회합니다.
 * 6. 검색된 노트로 Prompt Context와 Source Snapshot을 구성합니다.
 * 7. Runtime Prompt Template에 question과 context를 전달하여
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
    throw new Error(
      `Note chat conversation not found: ${params.conversationId}`,
    );
  }

  const currentUserMessage = detail.messages.find(
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

  const currentUserContent = noteChatUserMessageContentSchema.parse(
    currentUserMessage.content,
  );

  const embeddingMatches = await searchNoteChatEmbeddings({
    embeddingConfiguration: params.settings.embedding,
    ownerUserId: detail.conversation.user_id,
    question: currentUserContent.text,
  });

  const matchedNotes = await getMatchedNoteChatNotes({
    matches: embeddingMatches,
    ownerUserId: detail.conversation.user_id,
  });

  // TODO: 검색된 노트가 없는 경우 Chat Provider를 호출하지 않고,
  // 서버에서 고정된 안내 답변을 생성하여 Run을 성공 처리하는 경로를 추가한다.
  // 불필요한 LLM 호출과 토큰 사용을 방지하고,
  // Context 없이 일반 지식으로 답변하는 동작도 차단한다.

  const context = buildNoteChatContext({
    notes: matchedNotes,
  });

  const sources = buildNoteChatSources(matchedNotes);

  const messages = resolveNoteChatExecutionMessages({
    context,
    messages: detail.messages,
    systemTemplate: params.settings.chat.prompt.version.system_template,
    userMessageId: params.userMessageId,
    userTemplate: params.settings.chat.prompt.version.user_template,
  });

  return {
    conversation: detail.conversation,
    messages,
    settings: params.settings,
    sources,
    userMessageId: params.userMessageId,
  };
}
