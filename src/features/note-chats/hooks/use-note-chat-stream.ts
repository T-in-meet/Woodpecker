"use client";

import { useCallback, useRef, useState } from "react";

import {
  streamNoteChatQuestion,
  type StreamNoteChatQuestionInput,
  streamNoteChatUserMessageUpdate,
  type StreamNoteChatUserMessageUpdateInput,
} from "../stream/client";
import type { NoteChatStreamEvent } from "../stream/types";

/**
 * 노트 챗봇 스트리밍 실행 상태입니다.
 */
export type NoteChatStreamingState = {
  /** 스트리밍 중 누적된 AI 답변입니다. */
  content: string;

  /** 스트리밍 중 발생한 사용자 표시용 오류입니다. */
  error: string | null;

  /** 생성 완료된 Assistant Message ID입니다. */
  assistantMessageId: string | null;

  /** 현재 실행 중인 Run ID입니다. */
  runId: string | null;

  /** 답변 생성이 진행 중인지 여부입니다. */
  isStreaming: boolean;

  /** 완료된 답변에서 실제 사용한 노트 ID 목록입니다. */
  usedNoteIds: string[];
};

/**
 * 새로운 질문 스트리밍 요청 입력입니다.
 */
export type StartNoteChatStreamInput = {
  conversationId: string;
  question: string;
};

/**
 * 기존 사용자 질문 수정 스트리밍 요청 입력입니다.
 */
export type UpdateNoteChatStreamInput = {
  messageId: string;
  question: string;
};

/**
 * 노트 챗봇 질문 스트리밍을 관리합니다.
 *
 * 새 질문과 기존 질문 수정 모두 동일한 스트림 상태에 반영합니다.
 */
export function useNoteChatStream() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<NoteChatStreamingState>({
    assistantMessageId: null,
    content: "",
    error: null,
    isStreaming: false,
    runId: null,
    usedNoteIds: [],
  });

  /**
   * 현재 진행 중인 노트 챗봇 요청을 취소합니다.
   */
  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    setState((current) => ({
      ...current,
      isStreaming: false,
    }));
  }, []);

  /**
   * 서버 스트림 이벤트를 현재 상태에 반영합니다.
   */
  const applyStreamEvent = useCallback((event: NoteChatStreamEvent) => {
    switch (event.type) {
      case "start": {
        setState((current) => ({
          ...current,
          runId: event.runId,
        }));
        break;
      }

      case "text-delta": {
        setState((current) => ({
          ...current,
          content: current.content + event.delta,
        }));
        break;
      }

      case "finish": {
        setState((current) => ({
          ...current,
          assistantMessageId: event.assistantMessageId,
          isStreaming: false,
          runId: event.runId,
          usedNoteIds: event.usedNoteIds,
        }));
        break;
      }

      case "error": {
        setState((current) => ({
          ...current,
          error: event.message,
          isStreaming: false,
          runId: event.runId,
        }));
        break;
      }
    }
  }, []);

  /**
   * 새로운 노트 챗봇 질문 스트리밍을 시작합니다.
   */
  const start = useCallback(
    async (input: StartNoteChatStreamInput): Promise<void> => {
      abortControllerRef.current?.abort();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setState({
        assistantMessageId: null,
        content: "",
        error: null,
        isStreaming: true,
        runId: null,
        usedNoteIds: [],
      });

      const requestInput: StreamNoteChatQuestionInput = {
        conversationId: input.conversationId,
        content: {
          text: input.question,
        },
      };

      try {
        for await (const event of streamNoteChatQuestion(requestInput, {
          signal: abortController.signal,
        })) {
          applyStreamEvent(event);
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setState((current) => ({
          ...current,
          error:
            error instanceof Error
              ? error.message
              : "답변 생성 중 오류가 발생했습니다.",
          isStreaming: false,
        }));
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;

          setState((current) => ({
            ...current,
            isStreaming: false,
          }));
        }
      }
    },
    [applyStreamEvent],
  );

  /**
   * 기존 사용자 질문을 수정하고 새로운 답변 스트리밍을 시작합니다.
   *
   * 수정 대상 메시지 이후의 대화 정리는 서버의 수정 RPC가 담당합니다.
   */
  const update = useCallback(
    async (input: UpdateNoteChatStreamInput): Promise<void> => {
      abortControllerRef.current?.abort();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setState({
        assistantMessageId: null,
        content: "",
        error: null,
        isStreaming: true,
        runId: null,
        usedNoteIds: [],
      });

      const requestInput: StreamNoteChatUserMessageUpdateInput = {
        messageId: input.messageId,
        content: {
          text: input.question,
        },
      };

      try {
        for await (const event of streamNoteChatUserMessageUpdate(
          requestInput,
          {
            signal: abortController.signal,
          },
        )) {
          applyStreamEvent(event);
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setState((current) => ({
          ...current,
          error:
            error instanceof Error
              ? error.message
              : "질문 수정 후 답변 생성 중 오류가 발생했습니다.",
          isStreaming: false,
        }));
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;

          setState((current) => ({
            ...current,
            isStreaming: false,
          }));
        }
      }
    },
    [applyStreamEvent],
  );

  return {
    ...state,
    cancel,
    start,
    update,
  };
}
