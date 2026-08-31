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
  streamingContent: string;
  streamError: string | null;
  streamErrorCode: string | null;
  isStreaming: boolean;
  isAnswerGenerating: boolean;
  canRetry: boolean;
  retryCount: number;
  dailyUsage: NoteChatDailyUsage;
  messageEndRef: RefObject<HTMLDivElement | null>;
  scrollViewportRef: RefObject<HTMLDivElement | null>;
  shouldShowLatestMessageButton: boolean;
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
 * @param props.streamingContent 현재까지 수신한 Assistant 답변 내용
 * @param props.streamErrorCode 현재 스트리밍 요청의 구분 가능한 오류 코드
 * @param props.streamError 현재 스트리밍 오류
 * @param props.isStreaming 현재 브라우저에서 답변 스트림을 수신 중인지 여부
 * @param props.isAnswerGenerating 로컬 스트림 또는 서버 Claim 기준 답변 생성 진행 여부
 * @param props.canRetry 실패한 답변을 다시 실행할 수 있는지 여부
 * @param props.retryCount 현재 질문의 재시도 횟수
 * @param props.dailyUsage 현재 사용자의 Note Chat 일일 AI 실행 사용량
 * @param props.messageEndRef 최신 메시지 위치를 가리키는 ref
 * @param props.scrollViewportRef 실제 ScrollArea Viewport를 가리키는 ref
 * @param props.shouldShowLatestMessageButton 최신 메시지 이동 버튼 표시 여부
 * @param props.onViewportScroll ScrollArea Viewport 스크롤 처리 함수
 * @param props.onLatestMessageClick 최신 메시지 위치로 이동하는 함수
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
  streamingContent,
  streamError,
  streamErrorCode,
  isStreaming,
  isAnswerGenerating,
  canRetry,
  retryCount,
  dailyUsage,
  messageEndRef,
  scrollViewportRef,
  shouldShowLatestMessageButton,
  onViewportScroll,
  onLatestMessageClick,
  onCancel,
  onSubmit,
  onRetry,
  onUpdateQuestion,
}: NoteChatConversationContentProps) {
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
            streamingContent={streamingContent}
            streamError={streamError}
            streamErrorCode={streamErrorCode}
            isStreaming={isStreaming}
            isAnswerGenerating={isAnswerGenerating}
            canRetry={canRetry}
            retryCount={retryCount}
            dailyUsage={dailyUsage}
            onRetry={onRetry}
            onUpdateQuestion={onUpdateQuestion}
          />

          <div ref={messageEndRef} />
        </ScrollArea>

        {shouldShowLatestMessageButton ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-secondary/60 shadow-md hover:bg-secondary"
            aria-label="최신 메시지로 이동"
            onClick={onLatestMessageClick}
          >
            <ArrowDown />
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
