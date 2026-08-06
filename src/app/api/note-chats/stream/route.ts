import { NextResponse } from "next/server";

import { createNoteChatQuestionInputSchema } from "@/features/note-chats/schema";
import { runNoteChatStream } from "@/features/note-chats/stream/run-note-chat-stream";
import { encodeNoteChatStreamEvent } from "@/features/note-chats/stream/serialize";
import type { NoteChatStreamEvent } from "@/features/note-chats/stream/types";
import { createClient } from "@/lib/supabase/server";

/**
 * 새로운 사용자 질문과 Run을 생성한 뒤 AI 답변 스트림을 반환합니다.
 *
 * 질문과 Pending Run은 `create_note_chat_question` RPC를 통해
 * 하나의 트랜잭션으로 생성됩니다. 이후 생성된 Run을 실행하고,
 * 노트 챗봇 이벤트를 NDJSON 형식으로 클라이언트에 전달합니다.
 *
 * @param request 질문 생성 입력을 포함한 HTTP 요청
 * @returns NDJSON 스트림 또는 요청 오류 응답
 */
export async function POST(request: Request): Promise<Response> {
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

  const parsed = createNoteChatQuestionInputSchema.safeParse(input);

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

  const { content, conversationId, settings } = parsed.data;

  /*
   * 사용자 메시지와 Pending Run을 하나의 DB 트랜잭션으로 생성합니다.
   * RPC 내부에서 현재 사용자의 대화 소유권도 함께 검증합니다.
   */
  const { data: created, error: createError } = await supabase
    .rpc("create_note_chat_question", {
      p_agent_id: settings.agentId,
      p_chat_model_config_id: settings.chatModelConfigId,
      p_content: content,
      p_conversation_id: conversationId,
      p_embedding_model_config_id: settings.embeddingModelConfigId,
      p_prompt_version_id: settings.promptVersionId,
    })
    .single();

  if (createError || !created) {
    return NextResponse.json(
      {
        error: "질문 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      },
      {
        status: 500,
      },
    );
  }

  let streamClosed = false;

  const stream = new ReadableStream<Uint8Array>({
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
              runId: created.run_id,
              settings,
              userMessageId: created.user_message_id,
            },
            enqueueEvent,
          );
        } catch {
          if (!errorEventSent && !streamClosed) {
            enqueueEvent({
              message: "답변 생성에 실패했습니다.",
              runId: created.run_id,
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
