"use server";

import { z } from "zod";

import { requireCurrentLegalAcceptance } from "@/features/auth/utils/requireCurrentLegalAcceptance";
import {
  NOTE_CHAT_OPERATIONAL_ERROR_CODES,
  NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";
import { ROUTES } from "@/lib/constants/routes";
import { logError } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { escapePostgrestLikePattern } from "@/lib/utils/escapePostgrestLikePattern";

import { NOTE_CHAT_DAILY_EXECUTION_LIMIT } from "./constants/execution";
import { queryNoteChatConversationDetail } from "./internal-queries";
import type {
  NoteChatConversationDetail,
  NoteChatConversationListItem,
} from "./types";
import { reportNoteChatOperationalError } from "./utils/report-operational-error";

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
 * 현재 사용자의 Note Chat 일일 AI 실행 사용량입니다.
 *
 * 일일 실행 제한을 적용받는 일반 사용자에게만 반환하며,
 * quota를 우회하는 ADMIN에게는 null을 반환합니다.
 */
export type NoteChatDailyUsage = {
  used: number;
  limit: number;
} | null;

async function createLegalCheckedContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("로그인이 필요합니다.");
  }

  await requireCurrentLegalAcceptance(user.id, ROUTES.NOTE_CHATS);

  return { supabase, userId: user.id };
}

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
  const { supabase } = await createLegalCheckedContext();

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
    const term = escapePostgrestLikePattern(trimmedSearch).replace(/"/g, '\\"');

    query = query.ilike("title", `%${term}%`);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    // 목록 조회 조건과 페이지 정보를 남겨 동일한 DB 오류가
    // 어떤 조회 상황에서 발생했는지 운영 화면에서 추적할 수 있도록 한다.
    await reportNoteChatOperationalError({
      context: {
        page: normalizedPage,
        pageSize,
        searchApplied: trimmedSearch.length > 0,
      },
      error,
      errorCode:
        NOTE_CHAT_OPERATIONAL_ERROR_CODES.CONVERSATION_LIST_LOAD_FAILED,
      message: "노트 챗봇 대화 목록 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_CONVERSATION_LIST,
    });

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
  const { supabase, userId } = await createLegalCheckedContext();

  return queryNoteChatConversationDetail(supabase, conversationId, userId);
}

/**
 * 현재 사용자의 KST 기준 Note Chat 일일 AI 실행 사용량을 조회합니다.
 *
 * 일반 사용자는 execution claim을 기준으로 계산한 오늘 사용량과
 * 일일 실행 제한을 반환합니다.
 *
 * ADMIN은 일일 실행 제한을 적용받지 않으므로 사용량 RPC를 호출하지 않고
 * null을 반환합니다.
 *
 * 사용량이나 사용자 역할을 조회하지 못하더라도 Note Chat 자체의 이용을
 * 막지 않도록 사용량을 표시하지 않는 null로 처리합니다.
 */
export async function getNoteChatDailyUsage(): Promise<NoteChatDailyUsage> {
  const { supabase, userId } = await createLegalCheckedContext();

  /*
   * Note Chat 일일 quota는 일반 사용자에게만 적용됩니다.
   *
   * ADMIN에게 유한한 일일 제한이 있는 것처럼 표시하지 않도록
   * 먼저 현재 사용자의 role을 확인합니다.
   */
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    await reportNoteChatOperationalError({
      context: {},
      error: profileError,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.DAILY_USAGE_LOAD_FAILED,
      message:
        "노트 챗봇 일일 사용량 조회를 위한 사용자 역할 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_DAILY_USAGE,
    });

    return null;
  }

  if (profile?.role !== "USER") {
    return null;
  }

  /*
   * 실제 quota 판정과 동일하게 execution claim을 기준으로 계산하는
   * DB RPC를 사용하여 현재 사용자의 KST 기준 오늘 사용량을 조회합니다.
   *
   * Claim RPC가 실제 실행 제한의 정본이며,
   * 이 값은 현재 quota 상태를 사용자에게 표시하기 위한 용도로만 사용합니다.
   */
  const { data, error } = await supabase.rpc("get_note_chat_daily_usage");

  if (error) {
    await reportNoteChatOperationalError({
      context: {},
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.DAILY_USAGE_LOAD_FAILED,
      message: "노트 챗봇 일일 사용량 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.GET_DAILY_USAGE,
    });

    return null;
  }

  const parsedUsage = z.number().int().nonnegative().safeParse(data);

  if (!parsedUsage.success) {
    /*
     * usage RPC 자체는 성공했지만 예상한 런타임 계약과 다른 응답이므로
     * DB operational error로 기록하지 않고 defensive validation 오류로 남깁니다.
     *
     * 잘못된 사용량을 표시하지 않도록 usage는 null로 처리합니다.
     */
    logError({
      message: "[getNoteChatDailyUsage] 일일 사용량 응답 검증 실패",
      error: parsedUsage.error,
    });

    return null;
  }

  return {
    used: parsedUsage.data,
    limit: NOTE_CHAT_DAILY_EXECUTION_LIMIT,
  };
}
