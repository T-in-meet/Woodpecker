"use client";

import { useState } from "react";

import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";

import {
  noteChatAssistantMessageContentSchema,
  noteChatUserMessageContentSchema,
} from "../schema";
import type { NoteChatAssistantSources, NoteChatMessage } from "../types";
import { NoteChatAssistantMessage } from "./NoteChatAssistantMessage";
import { NoteChatEmptyState } from "./NoteChatEmptyState";
import { NoteChatQuestionEditDialog } from "./NoteChatQuestionEditDialog";
import { NoteChatStreamError } from "./NoteChatStreamError";
import { NoteChatStreamStatus } from "./NoteChatStreamStatus";
import { NoteChatUserMessage } from "./NoteChatUserMessage";

type NoteChatMessageListProps = {
  assistantSources: NoteChatAssistantSources[];

  messages: NoteChatMessage[];

  /** 아직 Query에 반영되지 않은 현재 사용자 질문입니다. */
  pendingQuestion?: string | null;

  /** 현재 스트리밍 중인 Assistant 답변입니다. */
  streamingContent?: string;

  /** 현재 스트리밍 오류입니다. */
  streamError?: string | null;

  /** 답변 생성이 진행 중인지 여부입니다. */
  isStreaming?: boolean;

  /** 실패한 답변을 다시 실행할 수 있는지 여부입니다. */
  canRetry?: boolean;

  /** 현재 질문의 재시도 횟수입니다. */
  retryCount?: number;

  /** 실패한 질문의 답변 생성을 다시 실행합니다. */
  onRetry?: () => Promise<void>;

  /** 기존 사용자 질문을 수정하고 다시 실행합니다. */
  onUpdateQuestion: (params: {
    messageId: string;
    question: string;
    sequenceNumber: number;
  }) => Promise<void>;
};

type EditingMessage = {
  id: string;
  sequenceNumber: number;
  text: string;
};

/**
 * 저장된 메시지와 현재 진행 중인 노트 챗봇 메시지를 렌더링합니다.
 *
 * @param props 컴포넌트 속성
 * @param props.assistantSources Assistant 메시지별 검색 노트 출처
 * @param props.messages 저장된 대화 메시지 목록
 * @param props.pendingQuestion 아직 Query에 반영되지 않은 현재 사용자 질문
 * @param props.streamingContent 현재까지 수신한 Assistant 답변 내용
 * @param props.streamError 현재 스트리밍 오류
 * @param props.isStreaming 답변 생성 진행 여부
 * @param props.canRetry 실패한 답변을 다시 실행할 수 있는지 여부
 * @param props.retryCount 현재 질문의 재시도 횟수
 * @param props.onRetry 실패한 답변 생성을 다시 실행하는 함수
 * @param props.onUpdateQuestion 기존 사용자 질문을 수정하고 다시 실행하는 함수
 * @returns 노트 챗봇 메시지 목록 UI
 */
export function NoteChatMessageList({
  assistantSources,
  messages,
  pendingQuestion = null,
  streamingContent = "",
  streamError = null,
  isStreaming = false,
  canRetry = false,
  retryCount = 0,
  onRetry,
  onUpdateQuestion,
}: NoteChatMessageListProps) {
  const [editingMessage, setEditingMessage] = useState<EditingMessage | null>(
    null,
  );

  const sourcesByAssistantMessageId = new Map(
    assistantSources.map((item) => [item.assistantMessageId, item.sources]),
  );

  const hasTransientMessage =
    pendingQuestion !== null ||
    streamingContent.length > 0 ||
    isStreaming ||
    streamError !== null;

  if (messages.length === 0 && !hasTransientMessage) {
    return <NoteChatEmptyState />;
  }

  return (
    <>
      <ul className="space-y-6 px-4 py-6 md:px-6">
        {messages.map((message) => {
          if (message.role === AI_CHAT_MESSAGE_ROLE.USER) {
            const parsed = noteChatUserMessageContentSchema.safeParse(
              message.content,
            );

            if (!parsed.success) {
              return null;
            }

            return (
              <NoteChatUserMessage
                key={message.id}
                text={parsed.data.text}
                isStreaming={isStreaming}
                onEdit={() => {
                  setEditingMessage({
                    id: message.id,
                    sequenceNumber: message.sequence_number,
                    text: parsed.data.text,
                  });
                }}
              />
            );
          }

          if (message.role === AI_CHAT_MESSAGE_ROLE.ASSISTANT) {
            const parsed = noteChatAssistantMessageContentSchema.safeParse(
              message.content,
            );

            if (!parsed.success) {
              return null;
            }

            return (
              <NoteChatAssistantMessage
                key={message.id}
                text={parsed.data.text}
                sources={sourcesByAssistantMessageId.get(message.id) ?? []}
                usedNoteIds={parsed.data.usedNoteIds}
              />
            );
          }

          return null;
        })}

        {pendingQuestion ? (
          <NoteChatUserMessage text={pendingQuestion} />
        ) : null}

        <NoteChatStreamStatus
          streamingContent={streamingContent}
          isStreaming={isStreaming}
        />

        {streamError ? (
          <NoteChatStreamError
            retryCount={retryCount}
            canRetry={canRetry}
            isStreaming={isStreaming}
            {...(onRetry ? { onRetry } : {})}
          />
        ) : null}
      </ul>

      <NoteChatQuestionEditDialog
        message={editingMessage}
        onClose={() => {
          setEditingMessage(null);
        }}
        onUpdateQuestion={onUpdateQuestion}
      />
    </>
  );
}
