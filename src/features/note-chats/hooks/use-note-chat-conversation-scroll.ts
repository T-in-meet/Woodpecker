"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const LATEST_MESSAGE_BUTTON_THRESHOLD_PX = 64;

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
 * 이후 새 질문, 수정 질문, 스트리밍 답변이 추가될 때는
 * 사용자가 최신 메시지 영역을 보고 있는 경우에만 자동으로
 * 최신 메시지 위치를 유지합니다.
 *
 * 사용자가 과거 메시지를 보기 위해 하단에서 일정 거리 이상
 * 벗어난 경우에는 streaming 중에도 강제로 하단으로 이동하지 않고
 * 최신 메시지 이동 버튼을 표시합니다.
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
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const hasInitialScrolledRef = useRef(false);

  const [shouldShowLatestMessageButton, setShouldShowLatestMessageButton] =
    useState(false);

  /**
   * 현재 viewport가 최신 메시지 영역에서 충분히 멀리 떨어져 있는지
   * 실제 scroll 위치를 기준으로 갱신합니다.
   */
  const handleViewportScroll = useCallback(() => {
    const viewport = scrollViewportRef.current;

    if (!viewport) {
      return;
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    setShouldShowLatestMessageButton(
      distanceFromBottom >= LATEST_MESSAGE_BUTTON_THRESHOLD_PX,
    );
  }, []);

  /**
   * 최신 메시지 위치로 부드럽게 이동합니다.
   */
  const scrollToLatestMessage = useCallback(() => {
    messageEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, []);

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
   * 사용자가 최신 메시지 영역을 보고 있는 경우에만
   * 최신 위치를 자동으로 유지합니다.
   *
   * 사용자가 과거 메시지를 탐색 중이면 자동 스크롤하지 않습니다.
   */
  useEffect(() => {
    if (!hasInitialScrolledRef.current || shouldShowLatestMessageButton) {
      return;
    }

    messageEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [
    messageCount,
    pendingQuestion,
    streamingContent,
    editingSequenceNumber,
    shouldShowLatestMessageButton,
  ]);

  return {
    handleViewportScroll,
    messageEndRef,
    scrollToLatestMessage,
    scrollViewportRef,
    shouldShowLatestMessageButton,
  };
}
