"use client";

import { NavigationGuardAlertDialog } from "@/components/common/NavigationGuardAlertDialog";
import { useBeforeUnloadGuard } from "@/hooks/useBeforeUnloadGuard";
import { useInternalNavigationGuard } from "@/hooks/useInternalNavigationGuard";

import { useNoteChatConversationExecution } from "../hooks/use-note-chat-conversation-execution";
import {
  useNoteChatConversationDetailQuery,
  useNoteChatConversationMessagesQuery,
} from "../hooks/use-note-chat-conversation-query";
import { useNoteChatConversationScroll } from "../hooks/use-note-chat-conversation-scroll";
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
  const conversationQuery = useNoteChatConversationDetailQuery(conversationId);
  const messagesQuery = useNoteChatConversationMessagesQuery(conversationId);

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
  const messagePages = messagesQuery.data?.pages ?? [];
  const orderedMessagePages = [...messagePages].reverse();
  const messages = orderedMessagePages.flatMap((page) => page?.messages ?? []);
  const assistantSources = orderedMessagePages.flatMap(
    (page) => page?.assistantSources ?? [],
  );

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

  /*
   * 답변 생성 중 앱 내부 페이지 이동은 바로 막지 않고,
   * 이동을 보류한 뒤 AlertDialog에서 사용자에게 이동 여부를 확인합니다.
   *
   * 현재 브라우저의 stream뿐 아니라 페이지 재진입 후 복원된
   * running Claim도 동일한 이탈 경고 대상으로 취급합니다.
   */
  const { cancelNavigation, confirmNavigation, isNavigationPending } =
    useInternalNavigationGuard({
      enabled: isAnswerGenerating,
    });

  /*
   * 새로고침, 탭 닫기 등 앱 내부 navigation으로 처리할 수 없는 이탈은
   * 브라우저의 beforeunload 기본 경고를 사용합니다.
   */
  useBeforeUnloadGuard({
    enabled: isAnswerGenerating,
  });

  const { containerRef: conversationContainerRef, height: conversationHeight } =
    useViewportRemainingHeight<HTMLDivElement>({
      recalculationKey: detail,
    });

  const {
    handleViewportScroll,
    messageEndRef,
    scrollToLatestMessage,
    scrollViewportRef,
    shouldShowLatestMessageButton,
  } = useNoteChatConversationScroll({
    conversationHeight,
    hasDetail:
      detail !== undefined &&
      detail !== null &&
      messagesQuery.data !== undefined,
    hasPreviousMessages: messagesQuery.hasNextPage,
    isFetchingPreviousMessages: messagesQuery.isFetchingNextPage,
    messageCount: messages.length,
    pendingQuestion,
    streamingContent,
    editingSequenceNumber,
    onLoadPreviousMessages: messagesQuery.fetchNextPage,
  });

  const visibleMessages =
    detail && editingSequenceNumber !== null
      ? messages.filter(
          (message) => message.sequence_number < editingSequenceNumber,
        )
      : messages;

  return (
    <>
      <NavigationGuardAlertDialog
        open={isNavigationPending}
        title="답변을 생성하고 있습니다."
        description="페이지를 이동해도 답변 생성은 계속됩니다. 이동하시겠습니까?"
        onCancel={cancelNavigation}
        onConfirm={confirmNavigation}
      />

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
            {conversationQuery.isLoading || messagesQuery.isLoading ? (
              <NoteChatConversationSkeleton />
            ) : conversationQuery.isError || messagesQuery.isError ? (
              <NoteChatConversationError
                isFetching={
                  conversationQuery.isFetching || messagesQuery.isFetching
                }
                onRetry={() => {
                  void conversationQuery.refetch();
                  void messagesQuery.refetch();
                }}
              />
            ) : !detail ? (
              <NoteChatConversationNotFound />
            ) : (
              <NoteChatConversationContent
                conversationId={conversationId}
                assistantSources={assistantSources}
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
                scrollViewportRef={scrollViewportRef}
                shouldShowLatestMessageButton={shouldShowLatestMessageButton}
                onViewportScroll={handleViewportScroll}
                onLatestMessageClick={scrollToLatestMessage}
                onCancel={onCancel}
                onSubmit={handleQuestionSubmit}
                onRetry={handleRetry}
                onUpdateQuestion={handleQuestionUpdate}
              />
            )}
          </section>
        </div>
      </div>
    </>
  );
}
