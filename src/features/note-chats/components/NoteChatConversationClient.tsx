"use client";

import { useEffect, useRef } from "react";

import { useNoteChatConversationExecution } from "../hooks/use-note-chat-conversation-execution";
import { useNoteChatConversationDetailQuery } from "../hooks/use-note-chat-conversation-query";
import { useNoteChatDailyUsageQuery } from "../hooks/use-note-chat-daily-usage-query";
import { useViewportRemainingHeight } from "../hooks/use-viewport-remaining-height";
import { NoteChatBreadcrumb } from "./NoteChatBreadcrumb";
import { NoteChatConversationContent } from "./NoteChatConversationContent";
import { NoteChatConversationError } from "./NoteChatConversationError";
import { NoteChatConversationMenu } from "./NoteChatConversationMenu";
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
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const hasInitialScrolledRef = useRef(false);

  const conversationQuery = useNoteChatConversationDetailQuery(conversationId);

  /*
   * Note Chat 일일 사용량은 특정 Conversation이 아니라
   * 현재 사용자의 전체 Note Chat AI 실행을 기준으로 조회합니다.
   *
   * ADMIN이나 사용량을 확인할 수 없는 경우에는 null이 반환되며,
   * Composer에서는 사용량 표시와 입력 제한을 적용하지 않습니다.
   */
  const dailyUsageQuery = useNoteChatDailyUsageQuery();

  const detail = conversationQuery.data;
  const dailyUsage = dailyUsageQuery.data ?? null;

  const {
    canRetry,
    editingSequenceNumber,
    handleQuestionSubmit,
    handleQuestionUpdate,
    handleRetry,
    isAnswerGenerating,
    isStreaming,
    onCancel,
    pendingQuestion,
    retryCount,
    streamError,
    streamErrorCode,
    streamingContent,
  } = useNoteChatConversationExecution({
    conversationId,
    hasRunningExecution: detail?.hasRunningExecution ?? false,
  });

  const { containerRef: conversationContainerRef, height: conversationHeight } =
    useViewportRemainingHeight<HTMLDivElement>({
      recalculationKey: detail,
    });

  /**
   * 최초 Conversation과 대화 영역 높이가 준비되면
   * 레이아웃 반영 후 최신 메시지 위치로 한 번만 이동합니다.
   */
  useEffect(() => {
    if (
      hasInitialScrolledRef.current ||
      !detail ||
      conversationHeight === null
    ) {
      return;
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      const messageEnd = messageEndRef.current;

      if (!messageEnd) {
        return;
      }

      messageEnd.scrollIntoView({
        behavior: "auto",
        block: "end",
      });

      hasInitialScrolledRef.current = true;
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [detail, conversationHeight]);

  /**
   * 새 질문, 수정 질문, 스트리밍 답변이 추가될 때
   * 메시지 영역을 최신 메시지 위치로 이동합니다.
   */
  useEffect(() => {
    if (!hasInitialScrolledRef.current) {
      return;
    }

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

  const visibleMessages =
    detail && editingSequenceNumber !== null
      ? detail.messages.filter(
          (message) => message.sequence_number < editingSequenceNumber,
        )
      : (detail?.messages ?? []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 md:px-12">
      {detail ? (
        <div className="my-4 flex items-center justify-between">
          <NoteChatBreadcrumb conversationTitle={detail.conversation.title} />
          <NoteChatConversationMenu
            conversationId={conversationId}
            title={detail.conversation.title}
          />
        </div>
      ) : null}

      <div
        ref={conversationContainerRef}
        className="flex min-h-0 flex-col overflow-hidden"
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
              assistantSources={detail.assistantSources}
              messages={visibleMessages}
              pendingQuestion={pendingQuestion}
              streamingContent={streamingContent}
              streamError={streamError}
              streamErrorCode={streamErrorCode}
              isStreaming={isStreaming}
              isAnswerGenerating={isAnswerGenerating}
              canRetry={canRetry}
              retryCount={retryCount}
              dailyUsage={dailyUsage}
              messageEndRef={messageEndRef}
              onCancel={onCancel}
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
