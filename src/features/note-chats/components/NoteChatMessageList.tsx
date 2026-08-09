"use client";

import { useState } from "react";

import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";

import {
  noteChatAssistantMessageContentSchema,
  noteChatUserMessageContentSchema,
} from "../schema";
import type { NoteChatAssistantSources, NoteChatMessage } from "../types";
import { NoteChatAssistantMessage } from "./NoteChatAssistantMessage";
import { NoteChatQuestionEditDialog } from "./NoteChatQuestionEditDialog";
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
 * 저장된 메시지와 현재 진행 중인 노트 챗봇 메시지를 표시합니다.
 */
export function NoteChatMessageList({
  assistantSources,
  messages,
  pendingQuestion = null,
  streamingContent = "",
  streamError = null,
  isStreaming = false,
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
    return (
      <div className="flex min-h-80 items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg space-y-6 text-center">
          <div className="space-y-2">
            <p className="text-lg font-semibold">무엇이 궁금한가요?</p>

            <p className="text-sm leading-6 text-muted-foreground">
              저장한 노트를 바탕으로 질문해 보세요. 관련된 노트를 찾아 답변을
              만들어 드립니다.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-left">
            <p className="text-xs font-medium text-muted-foreground">예시</p>

            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>• 내가 정리한 React Query 내용을 설명해줘.</li>
              <li>• 이 주제와 관련된 노트들을 비교해줘.</li>
              <li>• 이전에 공부한 내용을 간단히 복습시켜줘.</li>
            </ul>
          </div>
        </div>
      </div>
    );
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

        {streamingContent.length > 0 ? (
          <NoteChatAssistantMessage text={streamingContent} isStreaming />
        ) : isStreaming ? (
          <li className="flex justify-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>답변 생성 중</span>
              <span className="flex items-center gap-1" aria-hidden="true">
                <span className="size-1 animate-pulse rounded-full bg-current" />
                <span className="size-1 animate-pulse rounded-full bg-current [animation-delay:0.2s]" />
                <span className="size-1 animate-pulse rounded-full bg-current [animation-delay:0.4s]" />
              </span>
            </div>
          </li>
        ) : null}

        {streamError ? (
          <li className="flex justify-start">
            <p role="alert" className="text-sm text-destructive">
              {streamError}
            </p>
          </li>
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
