"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  NOTE_CHAT_QUESTION_MAX_LENGTH,
  NOTE_CHAT_VALIDATION_MESSAGE,
} from "../constants";
import { useNoteChatStream } from "../hooks/use-note-chat-stream";
import {
  type CreateNoteChatQuestionInput,
  createNoteChatQuestionInputSchema,
  type NoteChatRunSettings,
} from "../schema";

/**
 * 노트 챗봇 질문 입력 컴포넌트 Props입니다.
 */
type NoteChatComposerProps = {
  /** 질문을 추가할 노트 챗봇 대화 ID입니다. */
  conversationId: string;

  /** 노트 챗봇 실행에 사용할 AI 설정입니다. */
  settings: NoteChatRunSettings;
};

/**
 * 사용자 질문 입력과 노트 챗봇 답변 스트리밍을 담당합니다.
 *
 * 질문 폼은 React Hook Form과 Zod로 관리하며,
 * 답변 생성 상태는 `useNoteChatStream` 커스텀 훅으로 관리합니다.
 */
export function NoteChatComposer({
  conversationId,
  settings,
}: NoteChatComposerProps) {
  const {
    assistantMessageId,
    cancel,
    content,
    error: streamError,
    isStreaming,
    referencedNoteIds,
    runId,
    start,
  } = useNoteChatStream();

  const form = useForm<CreateNoteChatQuestionInput>({
    resolver: zodResolver(createNoteChatQuestionInputSchema),
    defaultValues: {
      conversationId,
      content: {
        text: "",
      },
      settings,
    },
  });

  const question = form.watch("content.text");
  const questionLength = question?.length ?? 0;

  /**
   * 검증이 완료된 질문으로 노트 챗봇 스트리밍을 시작합니다.
   *
   * 질문은 요청을 시작한 직후 입력창에서 제거합니다.
   * 스트림 실패 여부와 관계없이 사용자가 전송한 질문은 이미 서버의
   * 사용자 메시지와 Run으로 생성되므로 입력값을 다시 복원하지 않습니다.
   */
  const handleSubmit = form.handleSubmit(async (values) => {
    const submittedQuestion = values.content.text;

    form.reset({
      conversationId,
      content: {
        text: "",
      },
      settings,
    });

    await start({
      conversationId: values.conversationId,
      question: submittedQuestion,
      settings: values.settings,
    });
  });

  const questionError = form.formState.errors.content?.text?.message;
  const isSubmitDisabled =
    isStreaming || form.formState.isSubmitting || question.trim().length === 0;

  return (
    <section aria-label="노트 챗봇 질문 입력" className="space-y-4">
      {content.length > 0 ? (
        <div
          aria-live="polite"
          aria-label="생성 중인 AI 답변"
          className="whitespace-pre-wrap rounded-lg border bg-muted/40 p-4 text-sm leading-7"
        >
          {content}
        </div>
      ) : null}

      {streamError ? (
        <p role="alert" className="text-sm text-destructive">
          {streamError}
        </p>
      ) : null}

      <form className="space-y-3" onSubmit={handleSubmit}>
        <input type="hidden" {...form.register("conversationId")} />

        <input type="hidden" {...form.register("settings.agentId")} />

        <input type="hidden" {...form.register("settings.promptVersionId")} />

        <input type="hidden" {...form.register("settings.chatModelConfigId")} />

        <input
          type="hidden"
          {...form.register("settings.embeddingModelConfigId")}
        />

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
            rows={4}
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
              {NOTE_CHAT_VALIDATION_MESSAGE.QUESTION_REQUIRED}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {questionLength.toLocaleString()} /{" "}
            {NOTE_CHAT_QUESTION_MAX_LENGTH.toLocaleString()}
          </p>

          <div className="flex items-center gap-2">
            {isStreaming ? (
              <Button type="button" variant="outline" onClick={cancel}>
                생성 중지
              </Button>
            ) : null}

            <Button type="submit" disabled={isSubmitDisabled}>
              {isStreaming ? "답변 생성 중" : "질문 보내기"}
            </Button>
          </div>
        </div>
      </form>

      <p aria-live="polite" className="sr-only">
        {isStreaming
          ? "AI 답변을 생성하고 있습니다."
          : assistantMessageId && runId
            ? `답변 생성이 완료되었습니다. 참고 노트 ${referencedNoteIds.length}개`
            : ""}
      </p>
    </section>
  );
}
