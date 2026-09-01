"use client";

import { ArrowDown } from "lucide-react";
import { type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import { NOTE_CHAT_ASSISTANT_ACCURACY_NOTICE } from "../constants";
import type { NoteChatDailyUsage } from "../queries";
import type { NoteChatAssistantSources, NoteChatMessage } from "../types";
import { NoteChatComposer } from "./NoteChatComposer";
import { NoteChatMessageList } from "./NoteChatMessageList";

type NoteChatConversationContentProps = {
  conversationId: string;
  assistantSources: NoteChatAssistantSources[];
  messages: NoteChatMessage[];
  pendingQuestion: string | null;
  pendingQuestionMessageId: string | null;
  streamingContent: string;
  streamingAssistantMessageId: string | null;
  streamError: string | null;
  streamErrorCode: string | null;
  isStreaming: boolean;
  isAnswerGenerating: boolean;
  hasPreviousMessages: boolean;
  isFetchingPreviousMessages: boolean;
  canRetry: boolean;
  retryCount: number;
  dailyUsage: NoteChatDailyUsage;
  messageEndRef: RefObject<HTMLDivElement | null>;
  scrollViewportRef: RefObject<HTMLDivElement | null>;
  questionBottomSpacerHeight: number;
  shouldShowLatestMessageButton: boolean;
  registerUserMessageElement: (
    messageId: string | null,
    element: HTMLLIElement | null,
  ) => void;
  onViewportScroll: () => void;
  onLatestMessageClick: () => void;
  onCancel: () => void;
  onSubmit: (question: string) => Promise<void>;
  onRetry: () => Promise<void>;
  onUpdateQuestion: (params: {
    messageId: string;
    question: string;
    sequenceNumber: number;
  }) => Promise<void>;
};

/**
 * 조회된 Conversation의 메시지와 질문 입력 영역을 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @param props.conversationId 현재 Conversation ID
 * @param props.assistantSources Assistant 메시지별 검색 노트 출처
 * @param props.messages 화면에 표시할 Conversation 메시지 목록
 * @param props.pendingQuestion 아직 Query에 반영되지 않은 현재 사용자 질문
 * @param props.pendingQuestionMessageId 저장된 현재 사용자 질문의 메시지 ID
 * @param props.streamingContent 현재까지 수신한 Assistant 답변 내용
 * @param props.streamingAssistantMessageId 저장된 현재 Assistant 답변의 메시지 ID
 * @param props.streamErrorCode 현재 스트리밍 요청의 구분 가능한 오류 코드
 * @param props.streamError 현재 스트리밍 오류
 * @param props.isStreaming 현재 브라우저에서 답변 스트림을 수신 중인지 여부
 * @param props.isAnswerGenerating 로컬 스트림 또는 서버 Claim 기준 답변 생성 진행 여부
 * @param props.hasPreviousMessages 이전에 불러올 메시지가 남아 있는지 여부
 * @param props.isFetchingPreviousMessages 이전 메시지를 현재 불러오는 중인지 여부
 * @param props.canRetry 실패한 답변을 다시 실행할 수 있는지 여부
 * @param props.retryCount 현재 질문의 재시도 횟수
 * @param props.dailyUsage 현재 사용자의 Note Chat 일일 AI 실행 사용량
 * @param props.messageEndRef 최신 메시지 위치를 가리키는 ref
 * @param props.scrollViewportRef 실제 ScrollArea Viewport를 가리키는 ref
 * @param props.questionBottomSpacerHeight 질문을 viewport 시작점에 정렬하기 위한 하단 여백
 * @param props.shouldShowLatestMessageButton 최신 메시지 이동 버튼 표시 여부
 * @param props.registerUserMessageElement User 메시지 DOM 요소를 스크롤 대상으로 등록하는 함수
 * @param props.onViewportScroll ScrollArea Viewport 스크롤 처리 함수
 * @param props.onLatestMessageClick 최신 메시지 위치로 이동하고 follow를 활성화하는 함수
 * @param props.onCancel 현재 로컬 답변 스트림 표시를 중지하는 함수
 * @param props.onSubmit 새로운 사용자 질문을 전송하는 함수
 * @param props.onRetry 실패한 답변 생성을 다시 실행하는 함수
 * @param props.onUpdateQuestion 기존 사용자 질문을 수정하고 다시 실행하는 함수
 * @returns 조회된 Conversation 화면 UI
 */
export function NoteChatConversationContent({
  conversationId,
  assistantSources,
  messages,
  pendingQuestion,
  pendingQuestionMessageId,
  streamingContent,
  streamingAssistantMessageId,
  streamError,
  streamErrorCode,
  isStreaming,
  isAnswerGenerating,
  hasPreviousMessages,
  isFetchingPreviousMessages,
  canRetry,
  retryCount,
  dailyUsage,
  messageEndRef,
  scrollViewportRef,
  questionBottomSpacerHeight,
  shouldShowLatestMessageButton,
  registerUserMessageElement,
  onViewportScroll,
  onLatestMessageClick,
  onCancel,
  onSubmit,
  onRetry,
  onUpdateQuestion,
}: NoteChatConversationContentProps) {
  /*
   * 답변 생성 중에는 최신 메시지가 현재 viewport 안에 있더라도
   * 생성 상태를 계속 확인할 수 있도록 동일한 floating control을 유지합니다.
   */
  const shouldShowLatestControl =
    isAnswerGenerating || shouldShowLatestMessageButton;

  return (
    <>
      <div className="relative min-h-0 flex-1">
        <ScrollArea
          className="h-full"
          viewportClassName="[&>div]:!block [&>div]:!w-full [&>div]:!min-w-0"
          viewportRef={scrollViewportRef}
          onViewportScroll={onViewportScroll}
        >
          <NoteChatMessageList
            assistantSources={assistantSources}
            messages={messages}
            pendingQuestion={pendingQuestion}
            pendingQuestionMessageId={pendingQuestionMessageId}
            streamingContent={streamingContent}
            streamingAssistantMessageId={streamingAssistantMessageId}
            streamError={streamError}
            streamErrorCode={streamErrorCode}
            isStreaming={isStreaming}
            isAnswerGenerating={isAnswerGenerating}
            hasPreviousMessages={hasPreviousMessages}
            isFetchingPreviousMessages={isFetchingPreviousMessages}
            canRetry={canRetry}
            retryCount={retryCount}
            dailyUsage={dailyUsage}
            registerUserMessageElement={registerUserMessageElement}
            onRetry={onRetry}
            onUpdateQuestion={onUpdateQuestion}
          />

          {/*
           * 질문을 viewport 시작점에 정확히 배치하기 위해 필요한 경우에만
           * 실제 남은 공간만큼 하단 여백을 추가합니다.
           *
           * 최신 메시지 anchor는 spacer 앞에 두어 latest geometry와 follow가
           * 인위적인 여백을 최신 콘텐츠로 판단하지 않도록 합니다.
           */}
          <div ref={messageEndRef} />

          {questionBottomSpacerHeight > 0 ? (
            <div
              aria-hidden="true"
              style={{ height: questionBottomSpacerHeight }}
            />
          ) : null}
        </ScrollArea>

        {shouldShowLatestControl ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-secondary/60 shadow-md hover:bg-secondary"
            aria-label={
              isAnswerGenerating
                ? "답변 생성 중, 최신 메시지로 이동"
                : "최신 메시지로 이동"
            }
            onClick={onLatestMessageClick}
          >
            {isAnswerGenerating ? (
              <span
                aria-hidden="true"
                className="inline-flex min-w-5 items-center justify-center font-semibold"
              >
                {"...".split("").map((dot, index) => (
                  <span
                    key={index}
                    className="inline-block animate-bounce motion-reduce:animate-none"
                    style={{
                      animationDelay: `${index * 0.08}s`,
                      animationDuration: "0.8s",
                    }}
                  >
                    {dot}
                  </span>
                ))}
              </span>
            ) : (
              <ArrowDown />
            )}
          </Button>
        ) : null}
      </div>

      <div className="shrink-0 bg-background px-3 pb-3 md:px-4 md:pb-4">
        <p className="px-1 py-2 text-center text-xs text-muted-foreground">
          {NOTE_CHAT_ASSISTANT_ACCURACY_NOTICE}
        </p>

        <NoteChatComposer
          conversationId={conversationId}
          dailyUsage={dailyUsage}
          isStreaming={isStreaming}
          isAnswerGenerating={isAnswerGenerating}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
      </div>
    </>
  );
}
