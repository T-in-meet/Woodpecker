"use client";

import { ArrowDown } from "lucide-react";
import { type RefObject, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

import type { NoteChatDailyUsage } from "../queries";
import type { NoteChatAssistantSources, NoteChatMessage } from "../types";
import { NoteChatComposer } from "./NoteChatComposer";
import { NoteChatMessageList } from "./NoteChatMessageList";

/**
 * 최신 메시지 이동 버튼을 표시하기 시작하는 하단과의 거리입니다.
 *
 * 하단에서 아주 조금 벗어난 경우까지 버튼이 나타나는 것을 막고,
 * 사용자가 대화를 위로 탐색하고 있는 경우에만 버튼을 표시합니다.
 */
const LATEST_MESSAGE_BUTTON_THRESHOLD_PX = 64;

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
  onCancel,
  onSubmit,
  onRetry,
  onUpdateQuestion,
}: NoteChatConversationContentProps) {
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const [shouldShowLatestMessageButton, setShouldShowLatestMessageButton] =
    useState(false);

  /**
   * 실제 ScrollArea Viewport의 현재 위치를 기준으로
   * 최신 메시지 이동 버튼을 표시할지 결정합니다.
   *
   * 하단에서 일정 거리 이상 벗어난 경우에만 버튼을 표시해
   * 사용자가 과거 메시지를 탐색하고 있을 때 빠르게 최신 위치로
   * 돌아갈 수 있도록 합니다.
   */
  const handleViewportScroll = () => {
    const viewport = scrollViewportRef.current;

    if (!viewport) {
      return;
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    setShouldShowLatestMessageButton(
      distanceFromBottom > LATEST_MESSAGE_BUTTON_THRESHOLD_PX,
    );
  };

  /**
   * 기존 자동 스크롤에서도 사용하는 messageEndRef를 재사용해
   * 최신 메시지 위치로 부드럽게 이동합니다.
   */
  const handleLatestMessageClick = () => {
    messageEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  };

  return (
    <>
      <div className="relative min-h-0 flex-1">
        <ScrollArea
          className="h-full"
          viewportClassName="[&>div]:!block [&>div]:!w-full [&>div]:!min-w-0"
          viewportRef={scrollViewportRef}
          onViewportScroll={handleViewportScroll}
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
            onClick={handleLatestMessageClick}
          >
            <ArrowDown />
          </Button>
        ) : null}
      </div>

      <div className="shrink-0 bg-background px-3 pb-3 md:px-4 md:pb-4">
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
