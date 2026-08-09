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

type NoteChatUserMessageStreamRouteProps = {
  params: Promise<{
    messageId: string;
  }>;
};

/**
 * 기존 사용자 질문을 수정하고 이후 대화를 제거한 뒤
 * 새로운 AI 답변 스트림을 반환합니다.
 *
 * AI 설정은 클라이언트에서 전달받지 않습니다.
 * Note Chat에 연결된 AI Foundation Runtime Configuration을 서버에서 조회하고,
 * 확정된 동일 설정을 Run 생성과 실제 AI 실행에 사용합니다.
 *
 * @param request 수정된 사용자 질문을 포함한 HTTP 요청
 * @param params 수정할 User Message ID를 포함한 Route Params
 * @returns NDJSON 스트림 또는 요청 오류 응답
 */
export async function POST(
  request: Request,
  { params }: NoteChatUserMessageStreamRouteProps,
): Promise<Response> {
  const { messageId } = await params;

  let input: unknown;

  try {
    input = (await request.json()) as unknown;
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
    ...(typeof input === "object" && input !== null ? input : {}),
    messageId,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "노트 챗봇 질문 수정 정보가 올바르지 않습니다.",
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

  /*
   * 수정 대상 User Message의 Conversation ID를 확인합니다.
   *
   * 실제 수정 가능 여부는 update_note_chat_user_message RPC에서도
   * 현재 사용자와 User Message 여부를 다시 검증합니다.
   */
  const { data: targetMessage, error: targetMessageError } = await supabase
    .from("note_chat_messages")
    .select("conversation_id, role")
    .eq("id", parsed.data.messageId)
    .single();

  console.log("target message lookup", {
    messageId: parsed.data.messageId,
    targetMessage,
    targetMessageError,
  });

  if (targetMessageError || !targetMessage || targetMessage.role !== "user") {
    return NextResponse.json(
      {
        error: "수정할 사용자 메시지를 찾을 수 없습니다.",
      },
      {
        status: 404,
      },
    );
  }

  const conversationId = targetMessage.conversation_id;

  /*
   * Note Chat에 연결된 Chat·Embedding Runtime Configuration을 확정합니다.
   *
   * Runtime 계층에서 Prompt lifecycle, Agent 연결 관계,
   * Model 활성 상태와 capability가 이미 검증됩니다.
   */
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
  } catch (error) {
    console.error("Failed to load note chat AI configuration", error);

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
   * 기존 User Message를 수정하고 이후 Message를 삭제한 뒤
   * 새로운 Pending Run을 하나의 DB 트랜잭션으로 생성합니다.
   *
   * Run에는 이번 실행에서 실제 사용할 Agent·Prompt·Model ID를 기록합니다.
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

  const settings = {
    chat: chatConfiguration,
    embedding: embeddingConfiguration,
  };

  let streamClosed = false;

  const stream = new ReadableStream({
    start(controller) {
      let errorEventSent = false;

      /**
       * 스트림 이벤트를 NDJSON 데이터로 인코딩해 전달합니다.
       */
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
              conversationId,
              runId: updated.run_id,
              settings,
              userMessageId: updated.user_message_id,
            },
            enqueueEvent,
          );
        } catch (error) {
          console.log("답변 에러", error);

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
