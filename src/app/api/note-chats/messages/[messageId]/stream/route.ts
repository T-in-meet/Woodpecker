import { NextResponse } from "next/server";

import {
  NOTE_RETRIEVAL_AI_FEATURE_KEY,
  NOTE_RETRIEVAL_AI_ROLE_KEY,
} from "@/features/ai/rags/note/constants/runtime";
import { createAiRun } from "@/features/ai/runs/persistence";
import {
  AI_RUN_FEATURE_TYPE,
  type AiRunPersistenceHandle,
} from "@/features/ai/runs/types";
import {
  resolveAiRuntimeChatConfiguration,
  resolveAiRuntimeEmbeddingConfiguration,
} from "@/features/ai/runtimes";
import { isReportedAiOperationalError } from "@/features/ai/utils/report-ai-operational-error";
import { getLegalAcceptanceRequiredPath } from "@/features/auth/lib/userAgreements";
import { createNoteChatSnapshotAccumulator } from "@/features/note-chats/ai-runs/snapshot-accumulator";
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
import { updateNoteChatUserMessageInputSchema } from "@/features/note-chats/schema";
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
 * 확정된 동일 설정을 실제 AI 실행과 AI Run Snapshot에 사용합니다.
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
    .maybeSingle();

  if (targetMessageError) {
    /*
     * 수정 대상 메시지 조회 자체가 실패한 경우에는 정상적인 404로 숨기지 않고
     * DB 조회 장애로 운영 오류에 보고합니다.
     */
    await reportNoteChatOperationalError({
      actorUserId: user.id,
      context: {
        messageId: parsed.data.messageId,
      },
      error: targetMessageError,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.USER_MESSAGE_LOAD_FAILED,
      message: "노트 챗봇 수정 대상 메시지 조회에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.LOAD_USER_MESSAGE,
      stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.DATABASE,
      userId: user.id,
    });

    return NextResponse.json(
      {
        error: "수정할 사용자 메시지를 확인하지 못했습니다.",
      },
      {
        status: 500,
      },
    );
  }

  /*
   * 메시지가 없거나 User 역할이 아닌 경우에는 수정 가능한 대상이 아니므로
   * 운영 장애로 기록하지 않고 기존의 not-found 응답을 반환합니다.
   */
  if (!targetMessage || targetMessage.role !== "user") {
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
     * 답변 생성·질의 확장·노트 검색 Runtime 설정 중 하나라도
     * 확정하지 못하면 수정된 질문의 AI 실행을 시작할 수 없습니다.
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
        messageId: parsed.data.messageId,
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
        error: "질문 수정에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      },
      {
        status: 500,
      },
    );
  }

  /*
   * Claim이 quota와 conversation in-flight를 먼저 선점한 뒤 질문을 수정합니다.
   * 수정 RPC가 실패하면 사용자 기능 데이터가 바뀌지 않았으므로 claim을 failed로
   * 닫아 quota count에서 제외되도록 합니다.
   */
  const { data: updated, error: updateError } = await adminClient
    .rpc("update_note_chat_user_message", {
      p_content: parsed.data.content,
      p_message_id: parsed.data.messageId,
      p_user_id: user.id,
    })
    .single();

  if (updateError) {
    /*
     * 사용자 메시지 수정과 이후 대화 정리가 하나의 RPC에서 실패한 경우
     * 트랜잭션 실패 대상을 식별할 수 있는 ID만 기록합니다.
     * 수정된 질문 본문은 운영 오류 Context에 저장하지 않습니다.
     */
    await reportNoteChatOperationalError({
      actorUserId: user.id,
      context: {
        conversationId,
        messageId: parsed.data.messageId,
      },
      error: updateError,
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.USER_MESSAGE_UPDATE_FAILED,
      message: "노트 챗봇 사용자 메시지 수정에 실패했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.UPDATE_USER_MESSAGE,
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
        error: "질문 수정에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      },
      {
        status: 500,
      },
    );
  }

  if (!updated) {
    /*
     * DB 오류 없이 RPC 결과가 반환되지 않은 경우에도 정상적인 수정 완료가 아니므로
     * 데이터베이스 실행 결과 이상으로 운영 오류에 보고합니다.
     */
    await reportNoteChatOperationalError({
      actorUserId: user.id,
      context: {
        conversationId,
        messageId: parsed.data.messageId,
      },
      error: new Error(
        "update_note_chat_user_message returned no updated message result.",
      ),
      errorCode: NOTE_CHAT_OPERATIONAL_ERROR_CODES.USER_MESSAGE_UPDATE_FAILED,
      message: "노트 챗봇 사용자 메시지 수정 결과를 확인하지 못했습니다.",
      operation: NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.UPDATE_USER_MESSAGE,
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
        error: "질문 수정에 실패했습니다. 잠시 후 다시 시도해 주세요.",
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

  // precheck, claim, User Message 저장 뒤에만 실행별 accumulator를 생성한다.
  const snapshotAccumulator = createNoteChatSnapshotAccumulator();
  let aiRun: AiRunPersistenceHandle | null = null;

  /*
   * streamClosed는 ReadableStream 자체가 취소되거나 close된 상태를 나타냅니다.
   * deliveryFailed는 서버에서 클라이언트로 이벤트를 전달할 수 없게 된 상태를
   * 별도로 나타냅니다.
   *
   * 응답 전달 실패는 AI execution 실패와 구분하며,
   * 이미 진행 중인 AI execution과 저장 처리는 계속 수행합니다.
   */
  let streamClosed = false;
  let deliveryFailed = false;

  const stream = new ReadableStream({
    start(controller) {
      /**
       * 스트림 이벤트를 NDJSON 데이터로 인코딩해 클라이언트에 전달합니다.
       *
       * 응답 스트림 전송 실패는 AI execution 실패와 구분하여
       * operational error로 기록하고 runNoteChatStream으로 예외를 전파하지 않습니다.
       *
       * 한 번 전달에 실패하면 이후 이벤트 전송은 시도하지 않지만,
       * AI execution은 계속 진행하여 정상적인 실행 결과와 저장 상태를 유지합니다.
       *
       * @param event 클라이언트에 전달할 스트림 이벤트
       */
      const enqueueEvent = async (
        event: NoteChatStreamEvent,
      ): Promise<void> => {
        if (streamClosed || deliveryFailed) {
          return;
        }

        try {
          controller.enqueue(encodeNoteChatStreamEvent(event));
        } catch (error) {
          /*
           * 클라이언트 응답 전달에 한 번 실패하면
           * 이후 이벤트 전송은 중단합니다.
           *
           * 실제 ReadableStream 종료 상태와는 별개이므로
           * streamClosed는 여기에서 변경하지 않습니다.
           */
          deliveryFailed = true;

          try {
            await reportNoteChatOperationalError({
              actorUserId: user.id,
              context: {
                conversationId,
                eventType: event.type,
                aiRunId: aiRun?.id ?? null,
                userMessageId: updated.user_message_id,
              },
              error,
              errorCode:
                NOTE_CHAT_OPERATIONAL_ERROR_CODES.STREAM_EVENT_SEND_FAILED,
              message: "노트 챗봇 스트림 이벤트 전송에 실패했습니다.",
              operation:
                NOTE_CHAT_OPERATIONAL_ERROR_OPERATIONS.SEND_STREAM_EVENT,
              stage: NOTE_CHAT_OPERATIONAL_ERROR_STAGES.EXECUTION,
              userId: user.id,
            });
          } catch {
            /*
             * 스트림 전송 오류를 운영 오류로 기록하는 과정 자체가 실패하더라도
             * 전송 계층 오류가 AI execution 실패로 전파되지 않도록 무시합니다.
             */
          }
        }
      };

      void (async () => {
        /*
         * start와 finish/error는 HTTP 응답 lifecycle 이벤트이므로
         * runNoteChatStream이 아니라 Route가 직접 생성합니다.
         */
        await enqueueEvent({
          type: "start",
          userMessageId: updated.user_message_id,
        });

        try {
          // 실제 AI runner 진입 직전에 Run identity를 확정하고 초기 Snapshot 저장을 시도한다.
          aiRun = await createAiRun({
            buildSnapshot: snapshotAccumulator.buildSnapshot,
            featureType: AI_RUN_FEATURE_TYPE.NOTE_CHAT,
            startedAt: new Date().toISOString(),
            userId: user.id,
          });

          /*
           * runNoteChatStream은 AI execution과 결과 저장을 책임합니다.
           * 실제 답변의 text-delta 이벤트만 enqueueEvent를 통해 전달합니다.
           */
          const result = await runNoteChatStream(
            {
              aiRun,
              conversationId,
              claimId,
              settings,
              snapshotAccumulator,
              userId: user.id,
              userMessageId: updated.user_message_id,
            },
            enqueueEvent,
          );

          /*
           * AI execution과 결과 저장이 정상 완료된 뒤
           * Route가 최종 finish 이벤트를 전달합니다.
           *
           * finish 전달 실패는 이미 성공한 AI execution 결과를
           * 실패 상태로 되돌리지 않습니다.
           */
          await enqueueEvent({
            assistantMessageId: result.assistantMessageId,
            type: "finish",
            usedNoteIds: result.usedNoteIds,
          });
        } catch {
          /*
           * runNoteChatStream 자체가 실패한 경우에만
           * AI execution 실패를 클라이언트에 전달합니다.
           *
           * enqueueEvent 내부의 응답 전달 실패는 예외를 다시 던지지 않으므로
           * 이 catch에 들어오지 않습니다.
           */
          await enqueueEvent({
            message: "답변 생성에 실패했습니다.",
            type: "error",
          });
        } finally {
          /*
           * deliveryFailed 여부와 관계없이 실제 ReadableStream은
           * Route 실행 종료 시점에 닫습니다.
           */
          if (!streamClosed) {
            streamClosed = true;

            try {
              controller.close();
            } catch {
              /*
               * 클라이언트 취소 등으로 이미 스트림이 종료된 경우에는
               * 별도의 AI execution 실패로 취급하지 않습니다.
               */
            }
          }
        }
      })();
    },

    cancel() {
      /*
       * 클라이언트가 응답 스트림을 취소해도
       * AI execution 자체는 중단하거나 실패 처리하지 않습니다.
       *
       * 이후 서버→클라이언트 이벤트 전달만 중단합니다.
       */
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
