"use server";

import { redirect } from "next/navigation";

import {
  NOTE_CHAT_OPERATIONAL_ERROR_CODES,
  NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS,
} from "@/features/operational-errors/constants";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

import {
  createNoteChatConversationInputSchema,
  deleteNoteChatConversationInputSchema,
  updateNoteChatConversationTitleInputSchema,
} from "./schema";
import type { NoteChatConversation } from "./types";
import { reportNoteChatOperationalError } from "./utils/report-operational-error";

/**
 * 노트 챗봇 Conversation Action의 공통 실패 결과입니다.
 */
type NoteChatActionFailure = {
  success: false;
  error: string;
};

/**
 * 노트 챗봇 대화 생성 결과입니다.
 */
export type CreateNoteChatConversationActionResult =
  | {
      success: true;
      conversation: NoteChatConversation;
      error?: never;
    }
  | NoteChatActionFailure;

/**
 * 노트 챗봇 대화 제목 변경 결과입니다.
 */
export type UpdateNoteChatConversationTitleActionResult =
  | {
      success: true;
      conversation: NoteChatConversation;
      error?: never;
    }
  | NoteChatActionFailure;

/**
 * 노트 챗봇 대화 삭제 결과입니다.
 */
export type DeleteNoteChatConversationActionResult =
  | {
      success: true;
      conversationId: string;
      error?: never;
    }
  | NoteChatActionFailure;

/**
 * 인증 및 이메일 확인이 완료된 사용자의 Supabase Context입니다.
 */
type VerifiedNoteChatUserContext = {
  success: true;
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
};

/**
 * 현재 사용자가 노트 챗봇 Action을 실행할 수 있는지 확인합니다.
 *
 * 로그인하지 않은 경우 사용자 표시용 오류를 반환하고,
 * 이메일 확인이 완료되지 않은 경우 재전송 페이지로 이동합니다.
 */
async function getVerifiedNoteChatUserContext(): Promise<
  VerifiedNoteChatUserContext | NoteChatActionFailure
> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      success: false,
      error: "로그인이 필요합니다.",
    };
  }

  if (user.email_confirmed_at == null) {
    redirect(`${ROUTES.RESEND_EMAIL}?purpose=signup`);
  }

  return {
    success: true,
    supabase,
    userId: user.id,
  };
}

/**
 * 새로운 노트 챗봇 대화를 생성합니다.
 *
 * 생성된 대화는 현재 로그인한 사용자의 소유로 저장됩니다.
 *
 * @param input 대화 제목을 포함한 생성 입력
 * @returns 생성된 대화 또는 사용자 표시용 오류
 */
export async function createNoteChatConversationAction(
  input: unknown,
): Promise<CreateNoteChatConversationActionResult> {
  const parsed = createNoteChatConversationInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ??
        "노트 챗봇 대화 정보가 올바르지 않습니다.",
    };
  }

  const context = await getVerifiedNoteChatUserContext();

  if (!context.success) {
    return context;
  }

  const { data: conversation, error } = await context.supabase
    .from("note_chat_conversations")
    .insert({
      user_id: context.userId,
      title: parsed.data.title,
    })
    .select("*")
    .single();

  if (error) {
    // DB 생성 실패는 사용자 요청 실패와 별개로 운영 오류에 보고하여
    // 동일 오류를 집계하고 관리자가 장애 발생을 확인할 수 있도록 한다.
    await reportNoteChatOperationalError({
      actorUserId: context.userId,
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.CONVERSATION_CREATE_FAILED,
      message: "노트 챗봇 대화 생성에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.CREATE_CONVERSATION,
      userId: context.userId,
    });

    return {
      success: false,
      error: "노트 챗봇 대화 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  // DB 오류 없이 생성 결과가 없는 경우에는 운영 장애로 단정하지 않고
  // 기존 사용자 오류 응답만 반환한다.
  if (!conversation) {
    return {
      success: false,
      error: "노트 챗봇 대화 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  return {
    success: true,
    conversation,
  };
}

/**
 * 현재 사용자가 소유한 노트 챗봇 대화의 제목을 변경합니다.
 *
 * 제목 변경 시 Conversation의 `updated_at`도 함께 갱신합니다.
 *
 * @param input 대화 ID와 변경할 제목
 * @returns 변경된 대화 또는 사용자 표시용 오류
 */
export async function updateNoteChatConversationTitleAction(
  input: unknown,
): Promise<UpdateNoteChatConversationTitleActionResult> {
  const parsed = updateNoteChatConversationTitleInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ??
        "노트 챗봇 대화 정보가 올바르지 않습니다.",
    };
  }

  const context = await getVerifiedNoteChatUserContext();

  if (!context.success) {
    return context;
  }

  const now = new Date().toISOString();

  const { data: conversation, error } = await context.supabase
    .from("note_chat_conversations")
    .update({
      title: parsed.data.title,
      updated_at: now,
    })
    .eq("id", parsed.data.conversationId)
    .eq("user_id", context.userId)
    .select("*")
    .maybeSingle();

  if (error) {
    // 어떤 대화의 제목 변경에서 DB 오류가 발생했는지 추적할 수 있도록
    // 대화 ID만 context에 포함하고 사용자 입력 제목은 기록하지 않는다.
    await reportNoteChatOperationalError({
      actorUserId: context.userId,
      context: {
        conversationId: parsed.data.conversationId,
      },
      error,
      errorCode:
        NOTE_CHAT_OPERATIONAL_ERROR_CODES.CONVERSATION_TITLE_UPDATE_FAILED,
      message: "노트 챗봇 대화 제목 변경에 실패했습니다.",
      operation:
        NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.UPDATE_CONVERSATION_TITLE,
      userId: context.userId,
    });

    return {
      success: false,
      error:
        "노트 챗봇 대화 제목 변경에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  if (!conversation) {
    return {
      success: false,
      error: "변경할 노트 챗봇 대화를 찾을 수 없습니다.",
    };
  }

  return {
    success: true,
    conversation,
  };
}

/**
 * 현재 사용자가 소유한 노트 챗봇 대화를 삭제합니다.
 *
 * Conversation 삭제 시 연결된 Message와 Run은
 * 데이터베이스의 FK 삭제 정책에 따라 함께 정리됩니다.
 *
 * @param input 삭제할 대화 ID
 * @returns 삭제한 대화 ID 또는 사용자 표시용 오류
 */
export async function deleteNoteChatConversationAction(
  input: unknown,
): Promise<DeleteNoteChatConversationActionResult> {
  const parsed = deleteNoteChatConversationInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ??
        "노트 챗봇 대화 정보가 올바르지 않습니다.",
    };
  }

  const context = await getVerifiedNoteChatUserContext();

  if (!context.success) {
    return context;
  }

  const { data: deletedConversation, error } = await context.supabase
    .from("note_chat_conversations")
    .delete()
    .eq("id", parsed.data.conversationId)
    .eq("user_id", context.userId)
    .select("id")
    .maybeSingle();

  if (error) {
    // 삭제 실패 대상을 운영 오류에서 추적할 수 있도록
    // 사용자 입력 없이 conversationId만 context에 기록한다.
    await reportNoteChatOperationalError({
      actorUserId: context.userId,
      context: {
        conversationId: parsed.data.conversationId,
      },
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.CONVERSATION_DELETE_FAILED,
      message: "노트 챗봇 대화 삭제에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.DELETE_CONVERSATION,
      userId: context.userId,
    });

    return {
      success: false,
      error: "노트 챗봇 대화 삭제에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    };
  }

  if (!deletedConversation) {
    return {
      success: false,
      error: "삭제할 노트 챗봇 대화를 찾을 수 없습니다.",
    };
  }

  return {
    success: true,
    conversationId: deletedConversation.id,
  };
}
