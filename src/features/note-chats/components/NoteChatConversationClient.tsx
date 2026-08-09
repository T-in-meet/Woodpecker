"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE } from "../constants/execution";
import { noteChatQueryKeys } from "../constants/query-keys";
import { useNoteChatConversationDetailQuery } from "../hooks/use-note-chat-conversation-query";
import { useNoteChatStream } from "../hooks/use-note-chat-stream";
import { NoteChatConversationContent } from "./NoteChatConversationContent";
import { NoteChatConversationError } from "./NoteChatConversationError";
import { NoteChatConversationNotFound } from "./NoteChatConversationNotFound";
import { NoteChatConversationSkeleton } from "./NoteChatConversationSkeleton";

type NoteChatConversationClientProps = {
  conversationId: string;
};

/**
 * 선택한 노트 챗봇 Conversation 화면을 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @param props.conversationId 현재 Conversation ID
 * @returns 선택한 노트 챗봇 Conversation 화면 UI
 */
export function NoteChatConversationClient({
  conversationId,
}: NoteChatConversationClientProps) {
  const queryClient = useQueryClient();

  const conversationContainerRef = useRef<HTMLDivElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const [conversationHeight, setConversationHeight] = useState<number | null>(
    null,
  );
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  /**
   * 기존 질문 수정 중 현재 화면에 남길 메시지의 기준 sequence입니다.
   *
   * null이면 모든 저장 메시지를 표시하고,
   * 값이 있으면 해당 sequence 이전 메시지만 표시합니다.
   */
  const [editingSequenceNumber, setEditingSequenceNumber] = useState<
    number | null
  >(null);

  const [failedQuestion, setFailedQuestion] = useState<{
    messageId: string;
    question: string;
  } | null>(null);

  const [retryCount, setRetryCount] = useState(0);

  const {
    cancel,
    content: streamingContent,
    error: streamError,
    errorCode: streamErrorCode,
    isStreaming,
    reset,
    start,
    update,
  } = useNoteChatStream();

  const conversationQuery = useNoteChatConversationDetailQuery(conversationId);

  const detail = conversationQuery.data;

  /**
   * 새로운 질문을 전송하고 스트리밍 완료 후
   * Conversation 상세와 목록 데이터를 다시 조회합니다.
   *
   * 실행 실패 시 동일 User Message를 다시 실행할 수 있도록
   * 실패한 질문 정보를 유지합니다.
   *
   * @param question 새로 전송할 사용자 질문
   * @returns 질문 전송 및 서버 상태 동기화 완료 시점의 Promise
   */
  const handleQuestionSubmit = async (question: string) => {
    setPendingQuestion(question);
    setFailedQuestion(null);
    setRetryCount(0);

    const result = await start({
      conversationId,
      question,
    });

    /*
     * 질문 Route가 User Message를 먼저 저장하므로
     * 성공 여부와 관계없이 서버 상태를 다시 가져옵니다.
     */
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: noteChatQueryKeys.conversationDetail(conversationId),
      }),
      queryClient.invalidateQueries({
        queryKey: noteChatQueryKeys.conversationLists(),
      }),
    ]);

    setPendingQuestion(null);

    if (result.success) {
      reset();
      return;
    }

    /*
     * 일일 실행 횟수를 모두 사용한 경우에는 실제 Run이 생성되지 않으므로
     * 동일 질문을 다시 실행할 수 있는 재시도 대상으로 만들지 않습니다.
     */
    if (result.errorCode === NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE) {
      return;
    }

    if (result.userMessageId) {
      setFailedQuestion({
        messageId: result.userMessageId,
        question,
      });
    }
  };

  /**
   * 기존 사용자 질문을 수정하고 해당 질문 이후의 화면을
   * 새로운 대화 흐름으로 교체합니다.
   *
   * @param params 수정할 사용자 질문 정보
   * @param params.messageId 수정할 User Message ID
   * @param params.question 수정한 사용자 질문
   * @param params.sequenceNumber 수정할 메시지의 sequence 번호
   * @returns 질문 수정 및 서버 상태 동기화 완료 시점의 Promise
   */
  const handleQuestionUpdate = async ({
    messageId,
    question,
    sequenceNumber,
  }: {
    messageId: string;
    question: string;
    sequenceNumber: number;
  }) => {
    /*
     * 서버 응답을 기다리기 전에 수정 대상 이후의 기존 메시지를
     * 화면에서 제거하고 수정된 질문을 임시 메시지로 표시합니다.
     */
    setEditingSequenceNumber(sequenceNumber);
    setPendingQuestion(question);
    setFailedQuestion(null);
    setRetryCount(0);

    const result = await update({
      messageId,
      question,
    });

    /*
     * 수정 Route가 User Message 수정과 이후 Message 삭제,
     * 새 Run 생성을 처리하므로 실행 후 Conversation 데이터를 다시 조회합니다.
     */
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: noteChatQueryKeys.conversationDetail(conversationId),
      }),
      queryClient.invalidateQueries({
        queryKey: noteChatQueryKeys.conversationLists(),
      }),
    ]);

    setEditingSequenceNumber(null);
    setPendingQuestion(null);

    if (result.success) {
      reset();
      return;
    }

    /*
     * 일일 실행 횟수 초과는 재시도로 해결할 수 없으므로
     * 실패 질문으로 등록하지 않습니다.
     */
    if (result.errorCode === NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE) {
      return;
    }

    if (result.userMessageId) {
      setFailedQuestion({
        messageId: result.userMessageId,
        question,
      });
    }
  };

  /**
   * 실패한 사용자 질문을 동일한 User Message에서 다시 실행합니다.
   *
   * 새로운 User Message를 생성하지 않고 기존 질문 수정 Route를 사용하며,
   * 사용자 재시도는 최대 2회까지만 허용합니다.
   *
   * @returns 재시도 및 서버 상태 동기화 완료 시점의 Promise
   */
  const handleRetry = async () => {
    if (!failedQuestion || retryCount >= 2 || isStreaming) {
      return;
    }

    const result = await update({
      messageId: failedQuestion.messageId,
      question: failedQuestion.question,
    });

    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: noteChatQueryKeys.conversationDetail(conversationId),
      }),
      queryClient.invalidateQueries({
        queryKey: noteChatQueryKeys.conversationLists(),
      }),
    ]);

    if (result.success) {
      setFailedQuestion(null);
      setRetryCount(0);
      reset();
      return;
    }

    /*
     * 재시도 과정에서 일일 실행 횟수에 도달한 경우
     * 더 이상 재시도할 수 있는 상태로 유지하지 않습니다.
     */
    if (result.errorCode === NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE) {
      setFailedQuestion(null);
      return;
    }

    setRetryCount((current) => current + 1);
  };

  /**
   * 새 질문, 수정 질문, 스트리밍 답변이 추가될 때
   * 메시지 영역을 최신 메시지 위치로 이동합니다.
   */
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [
    detail?.messages.length,
    pendingQuestion,
    streamingContent,
    editingSequenceNumber,
  ]);

  /**
   * 현재 Conversation 영역의 시작 위치부터 viewport 하단까지의
   * 실제 사용 가능 높이를 계산합니다.
   */
  useEffect(() => {
    const updateConversationHeight = () => {
      const container = conversationContainerRef.current;

      if (!container) {
        return;
      }

      const top = container.getBoundingClientRect().top;

      setConversationHeight(Math.max(0, window.innerHeight - top));
    };

    updateConversationHeight();

    window.addEventListener("resize", updateConversationHeight);

    return () => {
      window.removeEventListener("resize", updateConversationHeight);
    };
  }, []);

  const visibleMessages =
    detail && editingSequenceNumber !== null
      ? detail.messages.filter(
          (message) => message.sequence_number < editingSequenceNumber,
        )
      : (detail?.messages ?? []);

  return (
    <div className="mx-auto -mb-16 flex w-full max-w-6xl flex-col px-4 md:mb-0 md:px-12">
      <div
        ref={conversationContainerRef}
        className="flex min-h-0 flex-col overflow-hidden border border-b-0"
        style={
          conversationHeight !== null
            ? { height: conversationHeight }
            : undefined
        }
      >
        <section className="flex min-h-0 flex-1 flex-col">
          {conversationQuery.isLoading ? (
            <NoteChatConversationSkeleton />
          ) : conversationQuery.isError ? (
            <NoteChatConversationError
              isFetching={conversationQuery.isFetching}
              onRetry={() => {
                void conversationQuery.refetch();
              }}
            />
          ) : !detail ? (
            <NoteChatConversationNotFound />
          ) : (
            <NoteChatConversationContent
              conversationId={conversationId}
              title={detail.conversation.title}
              assistantSources={detail.assistantSources}
              messages={visibleMessages}
              pendingQuestion={pendingQuestion}
              streamingContent={streamingContent}
              streamError={streamError}
              streamErrorCode={streamErrorCode}
              isStreaming={isStreaming}
              canRetry={failedQuestion !== null && retryCount < 2}
              retryCount={retryCount}
              messageEndRef={messageEndRef}
              onCancel={cancel}
              onSubmit={handleQuestionSubmit}
              onRetry={handleRetry}
              onUpdateQuestion={handleQuestionUpdate}
            />
          )}
        </section>
      </div>
    </div>
  );
}
