import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import {
  NOTE_CHAT_OPERATIONAL_ERROR_CODES,
  NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.types";

import { NOTE_CHAT_EXECUTION_STALE_AFTER_MS } from "./constants/execution";
import { noteChatRunSourceSchema } from "./schema";
import type { NoteChatConversationDetail } from "./types";
import { reportNoteChatOperationalError } from "./utils/report-operational-error";

type NoteChatQueryClient = SupabaseClient<Database>;

/**
 * 이미 인증·법적동의 검사를 마친 호출자가 전달한 RLS 클라이언트로
 * 현재 사용자의 대화 상세를 조회합니다.
 */
export async function queryNoteChatConversationDetail(
  supabase: NoteChatQueryClient,
  conversationId: string,
  userId: string,
): Promise<NoteChatConversationDetail | null> {
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

  const { data: messages, error: messagesError } = await supabase
    .from("note_chat_messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("sequence_number", { ascending: true });

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

  const assistantMessageIds = messages
    .filter((message) => message.role === "assistant")
    .map((message) => message.id);

  let assistantSources: NoteChatConversationDetail["assistantSources"] = [];

  if (assistantMessageIds.length > 0) {
    const { data: runs, error: runsError } = await supabase
      .from("note_chat_runs")
      .select("assistant_message_id, sources")
      .in("assistant_message_id", assistantMessageIds);

    if (runsError) {
      await reportNoteChatOperationalError({
        context: {
          conversationId: conversation.id,
        },
        error: runsError,
        errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.SOURCES_LOAD_FAILED,
        message: "노트 챗봇 참고 노트 조회에 실패했습니다.",
        operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_SOURCES,
      });

      throw new Error(
        `노트 챗봇 참고 노트 조회에 실패했습니다: ${runsError.message}`,
      );
    }

    assistantSources = (runs ?? []).flatMap((run) => {
      if (!run.assistant_message_id) {
        return [];
      }

      const parsedSources = z
        .array(noteChatRunSourceSchema)
        .safeParse(run.sources);

      if (!parsedSources.success) {
        return [];
      }

      return [
        {
          assistantMessageId: run.assistant_message_id,
          sources: parsedSources.data.map((source) => ({
            noteId: source.noteId,
            title: source.title,
          })),
        },
      ];
    });
  }

  return {
    assistantSources,
    conversation,
    hasRunningExecution,
    messages,
  };
}

/** 스트림 route에서 검증한 사용자 컨텍스트로 실행 데이터를 조회합니다. */
export async function getNoteChatConversationDetailForExecution(
  conversationId: string,
  userId: string,
): Promise<NoteChatConversationDetail | null> {
  const supabase = await createClient();

  return queryNoteChatConversationDetail(supabase, conversationId, userId);
}
