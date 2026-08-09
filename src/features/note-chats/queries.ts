"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

import { noteChatRunSourceSchema } from "./schema";
import type {
  NoteChatConversationDetail,
  NoteChatConversationListItem,
} from "./types";

export type GetNoteChatConversationListParams = {
  page?: number;
  search?: string;
};

export type NoteChatConversationListResult = {
  items: NoteChatConversationListItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/**
 * 현재 사용자의 노트 챗봇 대화 목록을 조회합니다.
 *
 * 제목 검색과 Offset 기반 페이지네이션을 지원하며,
 * 최근 활동 순으로 고정 정렬합니다.
 */
export async function getNoteChatConversationList({
  page = 1,
  search = "",
}: GetNoteChatConversationListParams = {}): Promise<NoteChatConversationListResult> {
  const supabase = await createClient();

  const pageSize = 20;
  const normalizedPage = Math.max(1, page);
  const from = (normalizedPage - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("note_chat_conversation_list")
    .select("*", {
      count: "exact",
    })
    .order("updated_at", {
      ascending: false,
    })
    .order("id", {
      ascending: false,
    });

  const trimmedSearch = search.trim();

  if (trimmedSearch) {
    const term = trimmedSearch
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_")
      .replace(/"/g, '\\"');

    query = query.ilike("title", `%${term}%`);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    throw new Error(
      `노트 챗봇 대화 목록 조회에 실패했습니다: ${error.message}`,
    );
  }

  const total = count ?? 0;

  return {
    items: data,
    page: normalizedPage,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 현재 사용자의 노트 챗봇 대화 상세를 조회합니다.
 *
 * 대화 기본 정보와 해당 대화의 전체 메시지를 함께 반환합니다.
 * 메시지는 대화 순서대로 표시할 수 있도록 `sequence_number` 오름차순으로 정렬합니다.
 *
 * @param conversationId 조회할 대화 ID
 * @returns 대화가 없거나 현재 사용자가 접근할 수 없으면 `null`
 */
export async function getNoteChatConversationDetail(
  conversationId: string,
): Promise<NoteChatConversationDetail | null> {
  const supabase = await createClient();

  const { data: conversation, error: conversationError } = await supabase
    .from("note_chat_conversations")
    .select("*")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) {
    throw new Error(
      `노트 챗봇 대화 조회에 실패했습니다: ${conversationError.message}`,
    );
  }

  if (!conversation) {
    return null;
  }

  const { data: messages, error: messagesError } = await supabase
    .from("note_chat_messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("sequence_number", { ascending: true });

  if (messagesError) {
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
    messages,
  };
}
