"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import {
  NoteChatStreamRequestError,
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

  /** 현재 실행을 발생시킨 사용자 메시지 ID입니다. */
  userMessageId: string | null;

  /** 스트리밍 요청에서 발생한 구분 가능한 오류 코드입니다. */
  errorCode: string | null;
};

/**
 * 노트 챗봇 스트리밍 실행 결과입니다.
 */
export type NoteChatStreamExecutionResult = {
  /** Assistant 답변 생성이 정상 완료됐는지 여부입니다. */
  success: boolean;

  /** 현재 실행을 발생시킨 사용자 메시지 ID입니다. */
  userMessageId: string | null;

  /** 실행 실패 시 서버에서 반환한 구분 가능한 오류 코드입니다. */
  errorCode: string | null;
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
  const router = useRouter();

  const [state, setState] = useState<NoteChatStreamingState>({
    assistantMessageId: null,
    content: "",
    error: null,
    errorCode: null,
    isStreaming: false,
    runId: null,
    usedNoteIds: [],
    userMessageId: null,
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
   * 완료된 스트림의 임시 상태를 초기화합니다.
   *
   * Conversation 상세 데이터를 다시 조회한 뒤 호출하여
   * 스트리밍 중 표시하던 임시 답변을 저장된 메시지로 교체합니다.
   */
  const reset = useCallback(() => {
    setState({
      assistantMessageId: null,
      content: "",
      error: null,
      errorCode: null,
      isStreaming: false,
      runId: null,
      usedNoteIds: [],
      userMessageId: null,
    });
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
          userMessageId: event.userMessageId,
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
          errorCode: null,
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
    async (
      input: StartNoteChatStreamInput,
    ): Promise<NoteChatStreamExecutionResult> => {
      abortControllerRef.current?.abort();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setState({
        assistantMessageId: null,
        content: "",
        error: null,
        errorCode: null,
        isStreaming: true,
        runId: null,
        usedNoteIds: [],
        userMessageId: null,
      });

      const requestInput: StreamNoteChatQuestionInput = {
        conversationId: input.conversationId,
        content: {
          text: input.question,
        },
      };

      let succeeded = false;
      let currentUserMessageId: string | null = null;

      try {
        for await (const event of streamNoteChatQuestion(requestInput, {
          signal: abortController.signal,
        })) {
          if (event.type === "start") {
            currentUserMessageId = event.userMessageId;
          }

          if (event.type === "finish") {
            succeeded = true;
          }

          applyStreamEvent(event);
        }

        return {
          success: succeeded,
          userMessageId: currentUserMessageId,
          errorCode: null,
        };
      } catch (error) {
        if (abortController.signal.aborted) {
          return {
            success: false,
            userMessageId: currentUserMessageId,
            errorCode: null,
          };
        }

        if (error instanceof NoteChatStreamRequestError && error.redirectTo) {
          router.replace(error.redirectTo);

          return {
            success: false,
            userMessageId: currentUserMessageId,
            errorCode: null,
          };
        }

        const errorCode =
          error instanceof NoteChatStreamRequestError ? error.code : null;

        setState((current) => ({
          ...current,
          error:
            error instanceof Error
              ? error.message
              : "답변 생성 중 오류가 발생했습니다.",
          errorCode,
          isStreaming: false,
        }));

        return {
          success: false,
          userMessageId: currentUserMessageId,
          errorCode,
        };
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
    [applyStreamEvent, router],
  );

  /**
   * 기존 사용자 질문을 수정하고 새로운 답변 스트리밍을 시작합니다.
   *
   * 수정 대상 메시지 이후의 대화 정리는 서버의 수정 RPC가 담당합니다.
   */
  const update = useCallback(
    async (
      input: UpdateNoteChatStreamInput,
    ): Promise<NoteChatStreamExecutionResult> => {
      abortControllerRef.current?.abort();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setState({
        assistantMessageId: null,
        content: "",
        error: null,
        errorCode: null,
        isStreaming: true,
        runId: null,
        usedNoteIds: [],
        userMessageId: null,
      });

      const requestInput: StreamNoteChatUserMessageUpdateInput = {
        messageId: input.messageId,
        content: {
          text: input.question,
        },
      };

      let succeeded = false;
      let currentUserMessageId: string | null = input.messageId;

      try {
        for await (const event of streamNoteChatUserMessageUpdate(
          requestInput,
          {
            signal: abortController.signal,
          },
        )) {
          if (event.type === "start") {
            currentUserMessageId = event.userMessageId;
          }

          if (event.type === "finish") {
            succeeded = true;
          }

          applyStreamEvent(event);
        }

        return {
          success: succeeded,
          userMessageId: currentUserMessageId,
          errorCode: null,
        };
      } catch (error) {
        if (abortController.signal.aborted) {
          return {
            success: false,
            userMessageId: currentUserMessageId,
            errorCode: null,
          };
        }

        if (error instanceof NoteChatStreamRequestError && error.redirectTo) {
          router.replace(error.redirectTo);

          return {
            success: false,
            userMessageId: currentUserMessageId,
            errorCode: null,
          };
        }

        const errorCode =
          error instanceof NoteChatStreamRequestError ? error.code : null;

        setState((current) => ({
          ...current,
          error:
            error instanceof Error
              ? error.message
              : "질문 수정 후 답변 생성 중 오류가 발생했습니다.",
          errorCode,
          isStreaming: false,
        }));

        return {
          success: false,
          userMessageId: currentUserMessageId,
          errorCode,
        };
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
    [applyStreamEvent, router],
  );

  return {
    ...state,
    cancel,
    reset,
    start,
    update,
  };
}
