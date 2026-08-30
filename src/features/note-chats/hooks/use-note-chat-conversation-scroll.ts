"use client";

import { useEffect, useRef } from "react";

type UseNoteChatConversationScrollParams = {
  conversationHeight: number | null;
  hasDetail: boolean;
  messageCount: number;
  pendingQuestion: string | null;
  streamingContent: string;
  editingSequenceNumber: number | null;
};

/**
 * Note Chat Conversation의 메시지 스크롤 위치를 관리합니다.
 *
 * 최초 Conversation과 대화 영역 높이가 준비되면
 * 최신 메시지 위치로 한 번 이동합니다.
 *
 * 이후 새 질문, 수정 질문, 스트리밍 답변이 추가될 때
 * 최신 메시지 위치로 부드럽게 이동합니다.
 *
 * @param params Hook 입력값
 * @param params.conversationHeight 현재 대화 영역 높이
 * @param params.hasDetail Conversation 상세 데이터 존재 여부
 * @param params.messageCount 현재 저장 메시지 수
 * @param params.pendingQuestion 화면에 임시 표시 중인 질문
 * @param params.streamingContent 현재 스트리밍 중인 답변 내용
 * @param params.editingSequenceNumber 수정 중인 메시지 sequence
 * @returns 메시지 끝 위치에 연결할 ref
 */
export function useNoteChatConversationScroll({
  conversationHeight,
  hasDetail,
  messageCount,
  pendingQuestion,
  streamingContent,
  editingSequenceNumber,
}: UseNoteChatConversationScrollParams) {
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const hasInitialScrolledRef = useRef(false);

  /**
   * 최초 Conversation과 대화 영역 높이가 준비되면
   * 레이아웃 반영 후 최신 메시지 위치로 한 번만 이동합니다.
   */
  useEffect(() => {
    if (
      hasInitialScrolledRef.current ||
      !hasDetail ||
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
  }, [hasDetail, conversationHeight]);

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
  }, [messageCount, pendingQuestion, streamingContent, editingSequenceNumber]);

  return {
    messageEndRef,
  };
}
