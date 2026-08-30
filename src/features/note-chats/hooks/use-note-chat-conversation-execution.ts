"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { NOTE_CHAT_DAILY_EXECUTION_LIMIT_ERROR_CODE } from "../constants/execution";
import { noteChatQueryKeys } from "../constants/query-keys";
import { useNoteChatStream } from "./use-note-chat-stream";

type UseNoteChatConversationExecutionParams = {
  conversationId: string;
  hasRunningExecution: boolean;
};

/**
 * Note Chat Conversation의 질문 실행 상태와 액션을 관리합니다.
 *
 * 새 질문 전송, 기존 질문 수정, 실패한 질문 재시도와
 * 로컬 streaming 상태 및 서버 running Claim 상태를 하나의
 * 답변 생성 상태로 결합합니다.
 *
 * @param params Hook 입력값
 * @param params.conversationId 현재 Conversation ID
 * @param params.hasRunningExecution 서버에 유효한 running Claim이 존재하는지 여부
 * @returns Conversation 실행 상태와 실행 액션
 */
export function useNoteChatConversationExecution({
  conversationId,
  hasRunningExecution,
}: UseNoteChatConversationExecutionParams) {
  const queryClient = useQueryClient();

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

  /*
   * 현재 브라우저에서 직접 소비 중인 stream뿐 아니라,
   * 페이지 이탈 후 서버에서 계속 실행 중인 Claim도
   * 답변 생성 중 상태로 취급합니다.
   */
  const isAnswerGenerating = isStreaming || hasRunningExecution;

  /**
   * 실행 완료 후 Conversation과 일일 사용량 관련 Query를 갱신합니다.
   */
  const invalidateConversationQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: noteChatQueryKeys.conversationDetail(conversationId),
      }),
      queryClient.invalidateQueries({
        queryKey: noteChatQueryKeys.conversationLists(),
      }),
      queryClient.invalidateQueries({
        queryKey: noteChatQueryKeys.dailyUsage(),
      }),
    ]);
  };

  /**
   * 새로운 질문을 전송합니다.
   *
   * 실행 실패 시 동일 User Message를 다시 실행할 수 있도록
   * 실패한 질문 정보를 유지합니다.
   *
   * @param question 새로 전송할 사용자 질문
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
     *
     * 일일 사용량도 execution claim의 최종 상태를 기준으로 다시 조회하여
     * 현재 quota 사용량을 화면에 반영합니다.
     */
    await invalidateConversationQueries();

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
   * 기존 사용자 질문을 수정하고 해당 질문 이후의 대화 흐름을 교체합니다.
   *
   * @param params 수정할 사용자 질문 정보
   * @param params.messageId 수정할 User Message ID
   * @param params.question 수정한 사용자 질문
   * @param params.sequenceNumber 수정할 메시지의 sequence 번호
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
     *
     * 새 실행의 Claim 상태에 따라 일일 사용량도 달라질 수 있으므로
     * 사용량 Query를 함께 갱신합니다.
     */
    await invalidateConversationQueries();

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
   */
  const handleRetry = async () => {
    if (!failedQuestion || retryCount >= 2 || isAnswerGenerating) {
      return;
    }

    const result = await update({
      messageId: failedQuestion.messageId,
      question: failedQuestion.question,
    });

    /*
     * 재시도에서도 새로운 execution claim이 생성될 수 있으므로
     * Conversation 데이터와 함께 일일 사용량을 다시 조회합니다.
     */
    await invalidateConversationQueries();

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

  return {
    canRetry: failedQuestion !== null && retryCount < 2 && !isAnswerGenerating,
    editingSequenceNumber,
    handleQuestionSubmit,
    handleQuestionUpdate,
    handleRetry,
    isAnswerGenerating,
    isStreaming,
    onCancel: cancel,
    pendingQuestion,
    retryCount,
    streamError,
    streamErrorCode,
    streamingContent,
  };
}
