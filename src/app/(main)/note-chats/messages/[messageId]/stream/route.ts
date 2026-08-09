import { NextResponse } from "next/server";

import {
  resolveAiRuntimeChatConfiguration,
  resolveAiRuntimeEmbeddingConfiguration,
} from "@/features/ai/runtimes/resolve-configuration";
import {
  NOTE_CHAT_AI_FEATURE_KEY,
  NOTE_CHAT_AI_ROLE_KEY,
} from "@/features/note-chats/constants/ai";
import { updateNoteChatUserMessageInputSchema } from "@/features/note-chats/schema";
import { runNoteChatStream } from "@/features/note-chats/stream/run-note-chat-stream";
import { encodeNoteChatStreamEvent } from "@/features/note-chats/stream/serialize";
import type { NoteChatStreamEvent } from "@/features/note-chats/stream/types";
import { createClient } from "@/lib/supabase/server";

type NoteChatMessageStreamRouteProps = {
  params: Promise<{
    messageId: string;
  }>;
};

/**
 * 기존 사용자 질문을 수정하고 이후 대화 흐름을 제거한 뒤
 * 수정된 질문으로 새로운 AI 답변 스트림을 시작합니다.
 *
 * @param request 수정할 질문 내용을 포함한 요청
 * @param props 수정 대상 Message ID를 포함한 Route params
 * @returns NDJSON 스트림 또는 요청 오류 응답
 */
export async function POST(
  request: Request,
  { params }: NoteChatMessageStreamRouteProps,
): Promise<Response> {
  const { messageId } = await params;

  let body: unknown;

  try {
    body = (await request.json()) as unknown;
  } catch {
    return NextResponse.json(
      {
        error: "요청 본문이 올바른 JSON 형식이 아닙니다.",
      },
      {
        status: 400,
      },
    );
  }

  const parsed = updateNoteChatUserMessageInputSchema.safeParse({
    messageId,
    ...(typeof body === "object" && body !== null ? body : {}),
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "노트 챗봇 질문 정보가 올바르지 않습니다.",
      },
      {
        status: 400,
      },
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      {
        error: "로그인이 필요합니다.",
      },
      {
        status: 401,
      },
    );
  }

  if (user.email_confirmed_at == null) {
    return NextResponse.json(
      {
        error: "이메일 확인이 필요합니다.",
      },
      {
        status: 403,
      },
    );
  }

  let chatConfiguration;
  let embeddingConfiguration;

  try {
    [chatConfiguration, embeddingConfiguration] = await Promise.all([
      resolveAiRuntimeChatConfiguration({
        featureKey: NOTE_CHAT_AI_FEATURE_KEY,
        roleKey: NOTE_CHAT_AI_ROLE_KEY.ANSWER_GENERATION,
      }),
      resolveAiRuntimeEmbeddingConfiguration({
        featureKey: NOTE_CHAT_AI_FEATURE_KEY,
        roleKey: NOTE_CHAT_AI_ROLE_KEY.NOTE_RETRIEVAL,
      }),
    ]);
  } catch {
    return NextResponse.json(
      {
        error: "노트 챗봇 AI 설정을 불러오지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }

  /*
   * 질문 수정, 이후 Message 삭제, 새 Pending Run 생성을
   * 하나의 DB 트랜잭션으로 처리합니다.
   */
  const { data: updated, error: updateError } = await supabase
    .rpc("update_note_chat_user_message", {
      p_agent_id: chatConfiguration.prompt.agent.id,
      p_chat_model_config_id: chatConfiguration.model.id,
      p_content: parsed.data.content,
      p_embedding_model_config_id: embeddingConfiguration.model.id,
      p_message_id: parsed.data.messageId,
      p_prompt_version_id: chatConfiguration.prompt.version.id,
    })
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      {
        error: "질문 수정에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      },
      {
        status: 500,
      },
    );
  }

  /*
   * RPC는 수정된 Message ID와 Run ID만 반환하므로,
   * 실행에 필요한 Conversation ID를 수정된 Message에서 조회합니다.
   */
  const { data: message, error: messageError } = await supabase
    .from("note_chat_messages")
    .select("conversation_id")
    .eq("id", updated.user_message_id)
    .maybeSingle();

  if (messageError || !message) {
    return NextResponse.json(
      {
        error: "수정된 대화 정보를 불러오지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }

  const settings = {
    chat: chatConfiguration,
    embedding: embeddingConfiguration,
  };

  let streamClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      let errorEventSent = false;

      const enqueueEvent = (event: NoteChatStreamEvent): void => {
        if (streamClosed) {
          return;
        }

        if (event.type === "error") {
          errorEventSent = true;
        }

        controller.enqueue(encodeNoteChatStreamEvent(event));
      };

      void (async () => {
        try {
          await runNoteChatStream(
            {
              conversationId: message.conversation_id,
              runId: updated.run_id,
              settings,
              userMessageId: updated.user_message_id,
            },
            enqueueEvent,
          );
        } catch {
          if (!errorEventSent && !streamClosed) {
            enqueueEvent({
              message: "답변 생성에 실패했습니다.",
              runId: updated.run_id,
              type: "error",
            });
          }
        } finally {
          if (!streamClosed) {
            streamClosed = true;
            controller.close();
          }
        }
      })();
    },

    cancel() {
      streamClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
    status: 200,
  });
}
