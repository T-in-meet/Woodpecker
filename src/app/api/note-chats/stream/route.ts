import { NextResponse } from "next/server";

import {
  NOTE_RETRIEVAL_AI_FEATURE_KEY,
  NOTE_RETRIEVAL_AI_ROLE_KEY,
} from "@/features/ai/rags/note/constants/runtime";
import {
  resolveAiRuntimeChatConfiguration,
  resolveAiRuntimeEmbeddingConfiguration,
} from "@/features/ai/runtimes";
import { isReportedAiOperationalError } from "@/features/ai/utils/report-ai-operational-error";
import { getLegalAcceptanceRequiredPath } from "@/features/auth/lib/userAgreements";
import {
  NOTE_CHAT_AI_FEATURE_KEY,
  NOTE_CHAT_AI_ROLE_KEY,
} from "@/features/note-chats/constants/ai";
import { NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE } from "@/features/note-chats/constants/execution";
import {
  claimNoteChatExecution,
  completeNoteChatExecutionClaim,
  NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS,
  NOTE_CHAT_EXECUTION_CLAIM_STATUS,
} from "@/features/note-chats/execution/execution-claim-persistence";
import { createNoteChatRunRecord } from "@/features/note-chats/execution/run-persistence";
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
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Note Chat AI 실행에 허용할 최대 서버 실행 시간(초)입니다.
 *
 * 질의 확장, 검색용 embedding 생성, 관련 Note 검색 및 답변 스트리밍까지
 * 하나의 요청에서 처리하므로 기본 실행 시간보다 긴 90초를 허용합니다.
 *
 * Next.js가 이 export를 Route 설정으로 직접 사용하므로
 * POST 함수에서 별도로 참조할 필요는 없습니다.
 */
export const maxDuration = 90;

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

  const agreementRequiredPath = await getLegalAcceptanceRequiredPath(
    user.id,
    ROUTES.NOTE_CHATS,
  );
  if (agreementRequiredPath) {
    return NextResponse.json(
      {
        error: "legal_acceptance_required",
        redirectTo: agreementRequiredPath,
      },
      { status: 403 },
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
          featureKey: NOTE_RETRIEVAL_AI_FEATURE_KEY,
          roleKey: NOTE_RETRIEVAL_AI_ROLE_KEY,
        }),
      ]);
  } catch (error) {
    /*
     * 답변 생성·질의 확장·노트 검색 설정 중 하나라도 확정할 수 없으면
     * 실행 자체를 시작할 수 없으므로 하나의 Runtime 설정 조회 실패로 보고합니다.
     */
    if (!isReportedAiOperationalError(error)) {
      await reportNoteChatOperationalError({
        actorUserId: user.id,
        error,
        errorCode:
          NOTE_CHAT_OPERATIONAL_ERROR_CODES.AI_CONFIGURATION_LOAD_FAILED,
        message: "노트 챗봇 AI 실행 설정 조회에 실패했습니다.",
        operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.LOAD_AI_CONFIGURATION,
        stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.CONFIGURATION,
        userId: user.id,
      });
    }

    return NextResponse.json(
      {
        error: "노트 챗봇 AI 설정을 불러오지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }

  const adminClient = createAdminClient();

  let claimId: string;

  try {
    const claimResult = await claimNoteChatExecution({
      conversationId,
      userId: user.id,
    });

    if (
      claimResult.status ===
      NOTE_CHAT_EXECUTION_CLAIM_STATUS.DAILY_LIMIT_EXCEEDED
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

    if (claimResult.status === NOTE_CHAT_EXECUTION_CLAIM_STATUS.DUPLICATE) {
      return NextResponse.json(
        {
          error: "이미 이 대화에서 답변을 생성하고 있습니다.",
        },
        {
          status: 409,
        },
      );
    }

    if (claimResult.claimId === null) {
      throw new Error("Note chat execution claim returned no claim ID.");
    }

    claimId = claimResult.claimId;
  } catch (error) {
    await reportNoteChatOperationalError({
      actorUserId: user.id,
      context: {
        conversationId,
      },
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.EXECUTION_CLAIM_FAILED,
      message: "노트 챗봇 실행 선점에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.CLAIM_EXECUTION,
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

  /*
   * Claim이 quota와 in-flight를 선점한 뒤 사용자 메시지를 생성합니다.
   * 이 단계가 실패하면 실제 실행은 시작되지 않았으므로 claim을 failed로
   * 닫아 quota count에서 제외되도록 합니다.
   */
  const { data: userMessageId, error: createError } = await adminClient.rpc(
    "create_note_chat_question",
    {
      p_content: content,
      p_conversation_id: conversationId,
      p_user_id: user.id,
    },
  );

  if (createError) {
    /*
     * 질문 생성 트랜잭션이 실패한 경우
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

    await completeClaimAfterPreExecutionFailure({
      claimId,
      conversationId,
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

  if (!userMessageId) {
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

    await completeClaimAfterPreExecutionFailure({
      claimId,
      conversationId,
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

  let runId: string | null = null;

  try {
    runId = await createNoteChatRunRecord({
      agentId: chatConfiguration.prompt.agent.id,
      chatModelConfigId: chatConfiguration.model.id,
      embeddingModelConfigId: embeddingConfiguration.model.id,
      promptVersionId: chatConfiguration.prompt.version.id,
      userMessageId,
    });
  } catch (error) {
    await reportNoteChatOperationalError({
      actorUserId: user.id,
      context: {
        conversationId,
        userMessageId,
      },
      error,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.RUN_CREATE_FAILED,
      message: "노트 챗봇 Run 실행 이력 생성에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.CREATE_RUN,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
      userId: user.id,
    });
  }

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
              claimId,
              runId,
              settings,
              userId: user.id,
              userMessageId,
            },
            enqueueEvent,
          );
        } catch {
          if (!errorEventSent && !streamClosed) {
            enqueueEvent({
              message: "답변 생성에 실패했습니다.",
              runId,
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

/**
 * Provider 실행 전 실패한 claim을 failed 상태로 닫습니다.
 *
 * @param params 완료할 claim과 오류 보고 context
 */
async function completeClaimAfterPreExecutionFailure(params: {
  claimId: string;
  conversationId: string;
  userId: string;
}): Promise<void> {
  try {
    await completeNoteChatExecutionClaim({
      claimId: params.claimId,
      status: NOTE_CHAT_EXECUTION_CLAIM_COMPLETION_STATUS.FAILED,
    });
  } catch (error) {
    await reportNoteChatOperationalError({
      actorUserId: params.userId,
      context: {
        claimId: params.claimId,
        conversationId: params.conversationId,
      },
      error,
      errorCode:
        NOTE_CHAT_OPERATIONAL_ERROR_CODES.EXECUTION_CLAIM_COMPLETE_FAILED,
      message: "노트 챗봇 실행 선점 실패 완료 처리에 실패했습니다.",
      operation:
        NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.COMPLETE_EXECUTION_CLAIM,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
      userId: params.userId,
    });
  }
}
