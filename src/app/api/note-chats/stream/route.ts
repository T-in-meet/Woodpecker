import { NextResponse } from "next/server";

import {
  resolveAiRuntimeChatConfiguration,
  resolveAiRuntimeEmbeddingConfiguration,
} from "@/features/ai/runtimes/resolve-configuration";
import {
  NOTE_CHAT_AI_FEATURE_KEY,
  NOTE_CHAT_AI_ROLE_KEY,
} from "@/features/note-chats/constants/ai";
import { NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE } from "@/features/note-chats/constants/execution";
import { assertNoteChatDailyExecutionLimit } from "@/features/note-chats/execution/assert-daily-execution-limit";
import { createNoteChatQuestionInputSchema } from "@/features/note-chats/schema";
import { runNoteChatStream } from "@/features/note-chats/stream/run-note-chat-stream";
import { encodeNoteChatStreamEvent } from "@/features/note-chats/stream/serialize";
import type { NoteChatStreamEvent } from "@/features/note-chats/stream/types";
import { reportNoteChatOperationalError } from "@/features/note-chats/utils/report-operational-error";
import {
  NOTE_CHAT_OPERATIONAL_ERROR_CODES,
  NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS,
  NOTE_CHAT_OPERATIONAL_ERROR_STAGES,
} from "@/features/operational-errors/constants";
import { createClient } from "@/lib/supabase/server";

/**
 * 새로운 사용자 질문과 Run을 생성한 뒤 AI 답변 스트림을 반환합니다.
 *
 * AI 설정은 클라이언트에서 전달받지 않습니다.
 * Note Chat에 연결된 AI Foundation Runtime Configuration을 서버에서 조회하고,
 * 확정된 동일 설정을 Run 생성과 실제 AI 실행에 사용합니다.
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

  /*
   * Note Chat의 일일 AI 실행 횟수를 제한합니다.
   *
   * 실제 Run을 생성하기 전에 검사하여 일일 사용량을 모두 사용한 경우
   * 새로운 AI 실행을 시작하지 않습니다.
   */
  try {
    await assertNoteChatDailyExecutionLimit(user.id);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE
    ) {
      return NextResponse.json(
        {
          code: NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE,
          error: "오늘 사용할 수 있는 노트 챗봇 횟수를 모두 사용했습니다.",
        },
        {
          status: 429,
        },
      );
    }

    /*
     * 일일 제한 초과 자체는 정상적인 사용량 정책 결과이므로 보고하지 않습니다.
     * 제한 확인 과정이 실패한 경우에만 운영 오류로 보고합니다.
     */
    await reportNoteChatOperationalError({
      actorUserId: user.id,
      error,
      errorCode:
        NOTE_CHAT_OPERATIONAL_ERROR_CODES.DAILY_EXECUTION_LIMIT_CHECK_FAILED,
      message: "노트 챗봇 일일 실행 제한 확인에 실패했습니다.",
      operation:
        NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.CHECK_DAILY_EXECUTION_LIMIT,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.EXECUTION_LIMIT,
      userId: user.id,
    });

    return NextResponse.json(
      {
        error: "노트 챗봇 사용량을 확인하지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }

  const { content, conversationId } = parsed.data;

  /*
   * Note Chat에 연결된 Chat·Embedding Runtime Configuration을 확정합니다.
   *
   * Runtime 계층에서 Prompt lifecycle, Agent 연결 관계,
   * Model 활성 상태와 capability가 이미 검증됩니다.
   */
  let chatConfiguration;
  let queryExpansionConfiguration;
  let embeddingConfiguration;

  try {
    [chatConfiguration, queryExpansionConfiguration, embeddingConfiguration] =
      await Promise.all([
        resolveAiRuntimeChatConfiguration({
          featureKey: NOTE_CHAT_AI_FEATURE_KEY,
          roleKey: NOTE_CHAT_AI_ROLE_KEY.ANSWER_GENERATION,
        }),
        resolveAiRuntimeChatConfiguration({
          featureKey: NOTE_CHAT_AI_FEATURE_KEY,
          roleKey: NOTE_CHAT_AI_ROLE_KEY.QUERY_EXPANSION,
        }),
        resolveAiRuntimeEmbeddingConfiguration({
          featureKey: NOTE_CHAT_AI_FEATURE_KEY,
          roleKey: NOTE_CHAT_AI_ROLE_KEY.NOTE_RETRIEVAL,
        }),
      ]);
  } catch (error) {
    /*
     * 답변 생성·질의 확장·노트 검색 설정 중 하나라도 확정할 수 없으면
     * 실행 자체를 시작할 수 없으므로 하나의 Runtime 설정 조회 실패로 보고합니다.
     */
    await reportNoteChatOperationalError({
      actorUserId: user.id,
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.AI_CONFIGURATION_LOAD_FAILED,
      message: "노트 챗봇 AI 실행 설정 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.LOAD_AI_CONFIGURATION,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.CONFIGURATION,
      userId: user.id,
    });

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
   * 사용자 메시지와 Pending Run을 하나의 DB 트랜잭션으로 생성합니다.
   *
   * Run에는 이번 실행에서 실제 사용할 Agent·Prompt·Model ID를 기록합니다.
   */
  const { data: created, error: createError } = await supabase
    .rpc("create_note_chat_question", {
      p_agent_id: chatConfiguration.prompt.agent.id,
      p_chat_model_config_id: chatConfiguration.model.id,
      p_content: content,
      p_conversation_id: conversationId,
      p_embedding_model_config_id: embeddingConfiguration.model.id,
      p_prompt_version_id: chatConfiguration.prompt.version.id,
    })
    .single();

  if (createError) {
    /*
     * 질문과 Pending Run을 생성하는 트랜잭션 자체가 실패한 경우
     * 대상 Conversation만 식별 정보로 남기고 질문 본문은 기록하지 않습니다.
     */
    await reportNoteChatOperationalError({
      actorUserId: user.id,
      context: {
        conversationId,
      },
      error: createError,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.QUESTION_CREATE_FAILED,
      message: "노트 챗봇 질문 생성에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.CREATE_QUESTION,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
      userId: user.id,
    });

    return NextResponse.json(
      {
        error: "질문 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      },
      {
        status: 500,
      },
    );
  }

  if (!created) {
    /*
     * DB 오류 없이 RPC 결과가 반환되지 않은 경우도 정상적인 생성 결과가 아니므로
     * 데이터베이스 실행 결과 이상으로 운영 오류에 보고합니다.
     */
    await reportNoteChatOperationalError({
      actorUserId: user.id,
      context: {
        conversationId,
      },
      error: new Error(
        "create_note_chat_question returned no created question result.",
      ),
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.QUESTION_CREATE_FAILED,
      message: "노트 챗봇 질문 생성 결과를 확인하지 못했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.CREATE_QUESTION,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
      userId: user.id,
    });

    return NextResponse.json(
      {
        error: "질문 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      },
      {
        status: 500,
      },
    );
  }

  const settings = {
    chat: chatConfiguration,
    queryExpansion: queryExpansionConfiguration,
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
              runId: created.run_id,
              settings,
              userId: user.id,
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
