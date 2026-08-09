"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send, Square } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { NOTE_CHAT_QUESTION_MAX_LENGTH } from "../constants";
import {
  type CreateNoteChatQuestionInput,
  createNoteChatQuestionInputSchema,
} from "../schema";

type NoteChatComposerProps = {
  /** 질문을 추가할 노트 챗봇 Conversation ID입니다. */
  conversationId: string;

  /** 현재 답변 생성이 진행 중인지 여부입니다. */
  isStreaming: boolean;

  /** 진행 중인 답변 생성을 취소합니다. */
  onCancel: () => void;

  /** 검증된 사용자 질문을 전달합니다. */
  onSubmit: (question: string) => Promise<void>;
};

/**
 * 노트 챗봇 사용자 질문 입력을 담당합니다.
 *
 * 스트리밍 실행 상태는 상위 Conversation 화면이 관리하며,
 * 이 컴포넌트는 질문 입력과 검증만 담당합니다.
 *
 * Enter는 질문을 전송하고,
 * Shift + Enter는 줄바꿈을 입력합니다.
 */
export function NoteChatComposer({
  conversationId,
  isStreaming,
  onCancel,
  onSubmit,
}: NoteChatComposerProps) {
  const form = useForm<CreateNoteChatQuestionInput>({
    resolver: zodResolver(createNoteChatQuestionInputSchema),
    defaultValues: {
      conversationId,
      content: {
        text: "",
      },
    },
  });

  const question = form.watch("content.text");
  const questionLength = question?.length ?? 0;

  const handleSubmit = form.handleSubmit(async (values) => {
    const submittedQuestion = values.content.text;

    form.reset({
      conversationId,
      content: {
        text: "",
      },
    });

    await onSubmit(submittedQuestion);
  });

  /**
   * Enter는 질문을 전송하고,
   * Shift + Enter는 기본 동작을 유지하여 줄바꿈합니다.
   */
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();

    if (isSubmitDisabled) {
      return;
    }

    event.currentTarget.form?.requestSubmit();
  };

  const questionError = form.formState.errors.content?.text?.message;

  const isSubmitDisabled =
    isStreaming || form.formState.isSubmitting || question.trim().length === 0;

  return (
    <section aria-label="노트 챗봇 질문 입력">
      <form className="space-y-3" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Textarea
            aria-describedby={
              questionError
                ? "note-chat-question-error"
                : "note-chat-question-description"
            }
            aria-invalid={questionError ? true : undefined}
            aria-label="노트 챗봇 질문"
            disabled={isStreaming}
            maxLength={NOTE_CHAT_QUESTION_MAX_LENGTH}
            placeholder="노트에 관해 질문해 보세요."
            rows={3}
            onKeyDown={handleKeyDown}
            {...form.register("content.text")}
          />

          {questionError ? (
            <p
              id="note-chat-question-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {questionError}
            </p>
          ) : (
            <p
              id="note-chat-question-description"
              className="text-xs text-muted-foreground"
            >
              Enter로 전송하고 Shift + Enter로 줄바꿈할 수 있습니다.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {questionLength.toLocaleString()} /{" "}
            {NOTE_CHAT_QUESTION_MAX_LENGTH.toLocaleString()}
          </p>

          <div className="flex shrink-0 items-center gap-2">
            {isStreaming ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onCancel}
              >
                <Square className="size-3.5" />
                생성 중지
              </Button>
            ) : null}

            <Button type="submit" size="sm" disabled={isSubmitDisabled}>
              {isStreaming ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  답변 생성 중
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  질문 보내기
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
      <p className="sr-only" aria-live="polite">
        {isStreaming ? "AI 답변을 생성하고 있습니다." : ""}
      </p>
    </section>
  );
}
