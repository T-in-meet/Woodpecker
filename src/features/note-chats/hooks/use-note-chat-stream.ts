"use client";

import { useCallback, useRef, useState } from "react";

import type { NoteChatRunSettings } from "../schema";
import {
  streamNoteChatQuestion,
  type StreamNoteChatQuestionInput,
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

  /** 완료된 답변의 참고 노트 순위입니다. */
  referencedNoteRanks: number[];
};

/**
 * 노트 챗봇 스트리밍 요청 입력입니다.
 */
export type StartNoteChatStreamInput = {
  conversationId: string;
  question: string;
  settings: NoteChatRunSettings;
};

/**
 * 노트 챗봇 질문 스트리밍을 관리합니다.
 *
 * 새 요청이 시작되면 이전 실행 상태를 초기화하고,
 * 서버에서 전달되는 NDJSON 이벤트를 순서대로 상태에 반영합니다.
 *
 * 컴포넌트 언마운트 또는 사용자의 명시적 취소 시
 * AbortController를 통해 진행 중인 HTTP 요청을 취소합니다.
 */
export function useNoteChatStream() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<NoteChatStreamingState>({
    assistantMessageId: null,
    content: "",
    error: null,
    isStreaming: false,
    referencedNoteRanks: [],
    runId: null,
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
   *
   * @param event 서버에서 전달된 노트 챗봇 스트림 이벤트
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
          referencedNoteRanks: event.referencedNoteRanks,
          runId: event.runId,
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
   *
   * @param input 대화 ID, 질문 및 AI 설정
   */
  const start = useCallback(
    async (input: StartNoteChatStreamInput): Promise<void> => {
      /*
       * 중복 실행을 방지하기 위해 기존 요청이 남아 있으면 먼저 취소합니다.
       */
      abortControllerRef.current?.abort();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setState({
        assistantMessageId: null,
        content: "",
        error: null,
        isStreaming: true,
        referencedNoteRanks: [],
        runId: null,
      });

      const requestInput: StreamNoteChatQuestionInput = {
        conversationId: input.conversationId,
        content: {
          text: input.question,
        },
        settings: input.settings,
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

  return {
    ...state,
    cancel,
    start,
  };
}
