import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  NOTE_CHAT_OPERATIONAL_ERROR_CODES,
  NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

import {
  NOTE_CHAT_EXECUTION_STALE_AFTER_MS,
  NOTE_CHAT_HISTORY_MESSAGE_LIMIT,
  NOTE_CHAT_MESSAGE_PAGE_SIZE,
} from "./constants/execution";
import { noteChatAssistantMessageContentSchema } from "./schema";
import type {
  NoteChatAssistantSources,
  NoteChatConversation,
  NoteChatConversationDetail,
  NoteChatConversationExecutionDetail,
  NoteChatMessage,
  NoteChatMessagePage,
} from "./types";
import { reportNoteChatOperationalError } from "./utils/report-operational-error";

type NoteChatQueryClient = SupabaseClient<Database>;

/**
 * 현재 사용자가 접근할 수 있는 Note Chat Conversation을 조회합니다.
 */
async function queryNoteChatConversationForUser(
  supabase: NoteChatQueryClient,
  conversationId: string,
  userId: string,
): Promise<NoteChatConversation | null> {
  const { data: conversation, error: conversationError } = await supabase
    .from("note_chat_conversations")
    .select("*")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (conversationError) {
    await reportNoteChatOperationalError({
      context: {
        conversationId,
      },
      error: conversationError,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.CONVERSATION_LOAD_FAILED,
      message: "노트 챗봇 대화 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_CONVERSATION,
    });

    throw new Error(
      `노트 챗봇 대화 조회에 실패했습니다: ${conversationError.message}`,
    );
  }

  return conversation;
}

/**
 * Assistant 메시지 ID 목록으로 표시용 참고 노트 출처를 조회합니다.
 */
async function queryNoteChatAssistantSources(
  supabase: NoteChatQueryClient,
  conversationId: string,
  userId: string,
  assistantMessages: NoteChatMessage[],
): Promise<NoteChatAssistantSources[]> {
  const messagesWithUsedNoteIds = assistantMessages.flatMap((message) => {
    const parsed = noteChatAssistantMessageContentSchema.safeParse(
      message.content,
    );

    return parsed.success
      ? [
          {
            assistantMessageId: message.id,
            usedNoteIds: parsed.data.usedNoteIds,
          },
        ]
      : [];
  });
  const noteIds = [
    ...new Set(messagesWithUsedNoteIds.flatMap((item) => item.usedNoteIds)),
  ];

  if (noteIds.length === 0) {
    return [];
  }

  // RLS client와 명시적인 user_id 조건을 함께 적용해 현재 접근 가능한 Note만 조회한다.
  const { data: notes, error: notesError } = await supabase
    .from("notes")
    .select("id, title")
    .eq("user_id", userId)
    .in("id", noteIds);

  if (notesError) {
    await reportNoteChatOperationalError({
      context: {
        conversationId,
      },
      error: notesError,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.SOURCES_LOAD_FAILED,
      message: "노트 챗봇 참고 노트 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_SOURCES,
    });

    throw new Error(
      `노트 챗봇 참고 노트 조회에 실패했습니다: ${notesError.message}`,
    );
  }

  const notesById = new Map((notes ?? []).map((note) => [note.id, note]));

  // 각 Message의 usedNoteIds 순서대로 최신 제목을 조립하고 누락된 Note는 제외한다.
  return messagesWithUsedNoteIds.map((item) => ({
    assistantMessageId: item.assistantMessageId,
    sources: item.usedNoteIds.flatMap((noteId) => {
      const note = notesById.get(noteId);
      return note ? [{ noteId: note.id, title: note.title }] : [];
    }),
  }));
}

/**
 * 이미 인증·법적동의 검사를 마친 호출자가 전달한 RLS 클라이언트로
 * 현재 사용자의 대화 상세 메타데이터를 조회합니다.
 */
export async function queryNoteChatConversationDetail(
  supabase: NoteChatQueryClient,
  conversationId: string,
  userId: string,
): Promise<NoteChatConversationDetail | null> {
  const conversation = await queryNoteChatConversationForUser(
    supabase,
    conversationId,
    userId,
  );

  if (!conversation) {
    return null;
  }

  const runningExecutionThreshold = new Date(
    Date.now() - NOTE_CHAT_EXECUTION_STALE_AFTER_MS,
  ).toISOString();

  const { data: runningExecution, error: runningExecutionError } =
    await supabase
      .from("note_chat_execution_claims")
      .select("id")
      .eq("user_id", userId)
      .eq("conversation_id", conversation.id)
      .eq("status", "running")
      .gte("claimed_at", runningExecutionThreshold)
      .limit(1)
      .maybeSingle();

  let hasRunningExecution = Boolean(runningExecution);

  if (runningExecutionError) {
    hasRunningExecution = false;

    await reportNoteChatOperationalError({
      context: {
        conversationId: conversation.id,
      },
      error: runningExecutionError,
      errorCode:
        NOTE_CHAT_OPERATIONAL_ERROR_CODES.RUNNING_EXECUTION_LOAD_FAILED,
      message: "노트 챗봇 실행 상태 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_RUNNING_EXECUTION,
    });
  }

  return {
    conversation,
    hasRunningExecution,
  };
}

/**
 * 현재 사용자의 대화 메시지를 최신 페이지부터 조회합니다.
 */
export async function queryNoteChatConversationMessagePage(
  supabase: NoteChatQueryClient,
  conversationId: string,
  userId: string,
  cursor: number | null = null,
): Promise<NoteChatMessagePage | null> {
  const conversation = await queryNoteChatConversationForUser(
    supabase,
    conversationId,
    userId,
  );

  if (!conversation) {
    return null;
  }

  /*
   * 최신 메시지부터 limit + 1개를 가져와 이전 페이지 존재 여부를 판단합니다.
   * 화면 렌더링에는 대화 순서가 필요하므로 반환 직전에 오름차순으로 복원합니다.
   */
  let messagesQuery = supabase
    .from("note_chat_messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("sequence_number", { ascending: false })
    .limit(NOTE_CHAT_MESSAGE_PAGE_SIZE + 1);

  if (cursor !== null) {
    messagesQuery = messagesQuery.lt("sequence_number", cursor);
  }

  const { data, error: messagesError } = await messagesQuery;

  if (messagesError) {
    await reportNoteChatOperationalError({
      context: {
        conversationId: conversation.id,
      },
      error: messagesError,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.MESSAGES_LOAD_FAILED,
      message: "노트 챗봇 메시지 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_MESSAGES,
    });

    throw new Error(
      `노트 챗봇 메시지 조회에 실패했습니다: ${messagesError.message}`,
    );
  }

  const pageMessages = (data ?? []).slice(0, NOTE_CHAT_MESSAGE_PAGE_SIZE);
  const messages = [...pageMessages].reverse();
  const oldestMessage = pageMessages.at(-1);
  const nextCursor =
    (data ?? []).length > NOTE_CHAT_MESSAGE_PAGE_SIZE && oldestMessage
      ? oldestMessage.sequence_number
      : null;

  const assistantMessages = messages.filter(
    (message) => message.role === "assistant",
  );

  const assistantSources = await queryNoteChatAssistantSources(
    supabase,
    conversation.id,
    userId,
    assistantMessages,
  );

  return {
    assistantSources,
    messages,
    nextCursor,
  };
}

/**
 * AI 실행에 필요한 현재 메시지와 직전 대화 이력을 제한된 개수로 조회합니다.
 */
async function queryNoteChatExecutionMessages(
  supabase: NoteChatQueryClient,
  conversationId: string,
  userMessageId: string,
): Promise<NoteChatMessage[]> {
  const { data: currentMessage, error: currentMessageError } = await supabase
    .from("note_chat_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("id", userMessageId)
    .maybeSingle();

  if (currentMessageError) {
    await reportNoteChatOperationalError({
      context: {
        conversationId,
        userMessageId,
      },
      error: currentMessageError,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.MESSAGES_LOAD_FAILED,
      message: "노트 챗봇 메시지 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_MESSAGES,
    });

    throw new Error(
      `노트 챗봇 메시지 조회에 실패했습니다: ${currentMessageError.message}`,
    );
  }

  if (!currentMessage) {
    return [];
  }

  const { data: previousMessages, error: previousMessagesError } =
    await supabase
      .from("note_chat_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .lt("sequence_number", currentMessage.sequence_number)
      .order("sequence_number", { ascending: false })
      .limit(NOTE_CHAT_HISTORY_MESSAGE_LIMIT);

  if (previousMessagesError) {
    await reportNoteChatOperationalError({
      context: {
        conversationId,
        userMessageId,
      },
      error: previousMessagesError,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.MESSAGES_LOAD_FAILED,
      message: "노트 챗봇 메시지 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_MESSAGES,
    });

    throw new Error(
      `노트 챗봇 메시지 조회에 실패했습니다: ${previousMessagesError.message}`,
    );
  }

  return [...(previousMessages ?? [])].reverse().concat(currentMessage);
}

/** 스트림 route에서 검증한 사용자 컨텍스트로 실행 데이터를 조회합니다. */
export async function getNoteChatConversationDetailForExecution(
  conversationId: string,
  userId: string,
  userMessageId: string,
): Promise<NoteChatConversationExecutionDetail | null> {
  const supabase = await createClient();

  const detail = await queryNoteChatConversationDetail(
    supabase,
    conversationId,
    userId,
  );

  if (!detail) {
    return null;
  }

  const messages = await queryNoteChatExecutionMessages(
    supabase,
    conversationId,
    userMessageId,
  );

  return {
    ...detail,
    messages,
  };
}
