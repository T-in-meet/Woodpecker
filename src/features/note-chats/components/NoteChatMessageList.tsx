"use client";

import { useState } from "react";

import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";

import { NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE } from "../constants/execution";
import type { NoteChatDailyUsage } from "../queries";
import {
  noteChatAssistantMessageContentSchema,
  noteChatUserMessageContentSchema,
} from "../schema";
import type { NoteChatAssistantSources, NoteChatMessage } from "../types";
import { NoteChatAssistantMessage } from "./NoteChatAssistantMessage";
import { NoteChatDailyExecutionLimitError } from "./NoteChatDailyExecutionLimitError";
import { NoteChatEmptyState } from "./NoteChatEmptyState";
import { NoteChatQuestionEditDialog } from "./NoteChatQuestionEditDialog";
import { NoteChatStreamError } from "./NoteChatStreamError";
import { NoteChatStreamStatus } from "./NoteChatStreamStatus";
import { NoteChatUserMessage } from "./NoteChatUserMessage";

/**
 * 노트 챗봇 메시지 목록 컴포넌트의 입력값입니다.
 */
type NoteChatMessageListProps = {
  /** Assistant 메시지별 검색 노트 출처입니다. */
  assistantSources: NoteChatAssistantSources[];

  /** 저장된 대화 메시지 목록입니다. */
  messages: NoteChatMessage[];

  /** 아직 Query에 반영되지 않은 현재 사용자 질문입니다. */
  pendingQuestion?: string | null;

  /** 현재 스트리밍 중인 Assistant 답변입니다. */
  streamingContent?: string;

  /** 현재 스트리밍 오류입니다. */
  streamError?: string | null;

  /** 현재 스트리밍 요청의 구분 가능한 오류 코드입니다. */
  streamErrorCode?: string | null;

  /** 현재 브라우저에서 Assistant 답변 스트림을 수신 중인지 여부입니다. */
  isStreaming?: boolean;

  /** 로컬 스트림 또는 서버 Claim 기준으로 답변 생성이 진행 중인지 여부입니다. */
  isAnswerGenerating?: boolean;

  /** 실패한 답변을 다시 실행할 수 있는지 여부입니다. */
  canRetry?: boolean;

  /** 현재 질문의 재시도 횟수입니다. */
  retryCount?: number;

  /**
   * 현재 사용자의 Note Chat 일일 AI 실행 사용량입니다.
   *
   * 일일 실행 제한을 적용받지 않는 ADMIN이나
   * 사용량을 확인할 수 없는 경우에는 null입니다.
   */
  dailyUsage: NoteChatDailyUsage;

  /** 실패한 질문의 답변 생성을 다시 실행합니다. */
  onRetry?: () => Promise<void>;

  /** 기존 사용자 질문을 수정하고 다시 실행합니다. */
  onUpdateQuestion: (params: {
    messageId: string;
    question: string;
    sequenceNumber: number;
  }) => Promise<void>;
};

/**
 * 현재 수정 중인 사용자 메시지 정보입니다.
 */
type EditingMessage = {
  id: string;
  sequenceNumber: number;
  text: string;
};

/**
 * 저장된 메시지와 현재 진행 중인 노트 챗봇 메시지를 렌더링합니다.
 *
 * 저장된 사용자/Assistant 메시지와 현재 진행 중인 질문 및 스트리밍 상태를
 * 하나의 메시지 목록으로 구성하고, 질문 수정 및 스트리밍 오류 UI를 함께 관리합니다.
 *
 * @param props 컴포넌트 속성
 * @param props.assistantSources Assistant 메시지별 검색 노트 출처
 * @param props.messages 저장된 대화 메시지 목록
 * @param props.pendingQuestion 아직 Query에 반영되지 않은 현재 사용자 질문
 * @param props.streamingContent 현재까지 수신한 Assistant 답변 내용
 * @param props.streamError 현재 스트리밍 오류
 * @param props.streamErrorCode 현재 스트리밍 요청의 구분 가능한 오류 코드
 * @param props.isStreaming 현재 브라우저에서 Assistant 답변 스트림을 수신 중인지 여부
 * @param props.isAnswerGenerating 로컬 스트림 또는 서버 Claim 기준 답변 생성 진행 여부
 * @param props.canRetry 실패한 답변을 다시 실행할 수 있는지 여부
 * @param props.retryCount 현재 질문의 재시도 횟수
 * @param props.dailyUsage 현재 사용자의 Note Chat 일일 AI 실행 사용량
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
  streamErrorCode = null,
  isStreaming = false,
  isAnswerGenerating = false,
  canRetry = false,
  retryCount = 0,
  dailyUsage,
  onRetry,
  onUpdateQuestion,
}: NoteChatMessageListProps) {
  const [editingMessage, setEditingMessage] = useState<EditingMessage | null>(
    null,
  );

  // 저장된 Assistant 메시지에 대응하는 참조 노트를 빠르게 조회할 수 있도록
  // Assistant 메시지 ID를 key로 사용하는 Map을 구성합니다.
  const sourcesByAssistantMessageId = new Map(
    assistantSources.map((item) => [item.assistantMessageId, item.sources]),
  );

  // 아직 저장되지 않은 질문이나 답변 생성 상태가 존재하는 경우에는
  // 저장된 메시지가 없어도 빈 대화 상태로 처리하지 않습니다.
  const hasTransientMessage =
    pendingQuestion !== null ||
    streamingContent.length > 0 ||
    isAnswerGenerating ||
    streamError !== null;

  if (messages.length === 0 && !hasTransientMessage) {
    return <NoteChatEmptyState />;
  }

  // 일일 실행 제한 오류는 일반 스트리밍 오류와 다른 안내 UI를 사용합니다.
  const isDailyExecutionLimitExceeded =
    streamErrorCode === NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE;

  /*
   * 일일 사용량은 AI 실행을 시작할 수 있는 UI 진입점을 제어하기 위해 사용합니다.
   *
   * 실제 실행 가능 여부의 정본은 서버의 execution claim이며,
   * ADMIN이나 사용량을 확인할 수 없는 경우에는 기존 동작을 유지합니다.
   */
  const isDailyLimitReached =
    dailyUsage !== null && dailyUsage.used >= dailyUsage.limit;

  return (
    <>
      <ul className="space-y-6 px-4 pb-4">
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
                isStreaming={isAnswerGenerating}
                {...(!isDailyLimitReached && !isAnswerGenerating
                  ? {
                      onEdit: () => {
                        setEditingMessage({
                          id: message.id,
                          sequenceNumber: message.sequence_number,
                          text: parsed.data.text,
                        });
                      },
                    }
                  : {})}
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

        {/* 아직 저장되지 않은 현재 질문은 저장된 메시지 다음에 임시로 표시합니다. */}
        {pendingQuestion ? (
          <NoteChatUserMessage text={pendingQuestion} />
        ) : null}

        {/* 로컬 스트림 또는 복원된 서버 실행의 답변 생성 상태를 표시합니다. */}
        <NoteChatStreamStatus
          streamingContent={streamingContent}
          isAnswerGenerating={isAnswerGenerating}
        />

        {/* 일일 실행 제한과 일반 스트리밍 오류는 서로 다른 오류 UI를 사용합니다. */}
        {streamError ? (
          isDailyExecutionLimitExceeded ? (
            <NoteChatDailyExecutionLimitError />
          ) : (
            <NoteChatStreamError
              retryCount={retryCount}
              canRetry={canRetry && !isDailyLimitReached}
              isStreaming={isStreaming}
              {...(onRetry ? { onRetry } : {})}
            />
          )
        ) : null}
      </ul>

      {/* 수정 대상 사용자 메시지가 선택되면 질문 수정 Dialog를 표시합니다. */}
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
