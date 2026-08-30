"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send, Square } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useForm } from "react-hook-form";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import { NOTE_CHAT_QUESTION_MAX_LENGTH } from "../constants";
import type { NoteChatDailyUsage } from "../queries";
import {
  type CreateNoteChatQuestionInput,
  createNoteChatQuestionInputSchema,
} from "../schema";

type NoteChatComposerProps = {
  /** 질문을 추가할 노트 챗봇 Conversation ID입니다. */
  conversationId: string;

  /**
   * 현재 사용자의 Note Chat 일일 AI 실행 사용량입니다.
   *
   * 일일 실행 제한을 적용받지 않는 ADMIN이나
   * 사용량을 확인할 수 없는 경우에는 null입니다.
   */
  dailyUsage: NoteChatDailyUsage;

  /** 현재 답변 생성이 진행 중인지 여부입니다. */
  isStreaming: boolean;

  /**
   * 현재 화면의 답변 스트리밍 표시를 중지합니다.
   *
   * 서버에서 이미 시작된 AI 실행 자체는 계속 진행되며,
   * 해당 실행은 일일 사용 횟수에 포함됩니다.
   */
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
 * 일반 사용자가 일일 AI 실행 제한에 도달한 경우
 * 추가 질문 입력과 전송을 차단합니다.
 *
 * Enter는 질문을 전송하고,
 * Shift + Enter는 줄바꿈을 입력합니다.
 *
 * 답변 표시 중지 버튼은 실제 서버 AI 실행을 취소하지 않으므로,
 * 사용자가 중지 동작과 사용 횟수 차감 정책을 확인한 뒤
 * 실행할 수 있도록 Alert Dialog를 표시합니다.
 */
export function NoteChatComposer({
  conversationId,
  dailyUsage,
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

  /*
   * 일일 사용량은 사용자 안내와 입력 차단을 위한 클라이언트 상태이며,
   * 실제 실행 가능 여부의 정본은 서버의 execution claim입니다.
   */
  const isDailyLimitReached =
    dailyUsage !== null && dailyUsage.used >= dailyUsage.limit;

  const isSubmitDisabled =
    isStreaming ||
    isDailyLimitReached ||
    form.formState.isSubmitting ||
    question.trim().length === 0;

  const handleSubmit = form.handleSubmit(async (values) => {
    /*
     * 사용량 Query가 갱신되기 전의 짧은 시점에도
     * 이미 한도에 도달한 상태라면 클라이언트에서 전송하지 않습니다.
     *
     * 서버에서도 execution claim이 최종적으로 quota를 검증합니다.
     */
    if (isDailyLimitReached) {
      return;
    }

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
            disabled={isStreaming || isDailyLimitReached}
            maxLength={NOTE_CHAT_QUESTION_MAX_LENGTH}
            placeholder={
              isDailyLimitReached
                ? "오늘의 AI 답변 생성 횟수를 모두 사용했습니다."
                : "노트에 관해 질문해 보세요."
            }
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
          ) : isDailyLimitReached ? (
            <p
              id="note-chat-question-description"
              className="text-xs text-muted-foreground"
            >
              {`오늘은 AI 답변을 더 생성할 수 없어요. (${dailyUsage.used}/${dailyUsage.limit})`}
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
          <div className="flex items-center gap-3">
            <p className="text-xs text-muted-foreground">
              {questionLength.toLocaleString()} /{" "}
              {NOTE_CHAT_QUESTION_MAX_LENGTH.toLocaleString()}
            </p>

            {dailyUsage !== null && !isDailyLimitReached ? (
              <p className="text-xs text-muted-foreground">
                {`오늘 ${dailyUsage.used}/${dailyUsage.limit}회 사용`}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isStreaming ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" size="sm" variant="outline">
                    <Square className="size-3.5" />
                    답변 표시 중지
                  </Button>
                </AlertDialogTrigger>

                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      답변 표시를 중지하시겠어요?
                    </AlertDialogTitle>

                    <AlertDialogDescription>
                      화면의 답변 표시만 중지됩니다. 이미 시작된 AI 실행은
                      서버에서 계속 진행되며, 이번 실행은 오늘 사용 횟수에
                      포함됩니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>

                  <AlertDialogFooter>
                    <AlertDialogCancel>계속 보기</AlertDialogCancel>

                    <AlertDialogAction onClick={onCancel}>
                      표시 중지
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
        {isStreaming
          ? "AI 답변을 생성하고 있습니다."
          : isDailyLimitReached
            ? "오늘의 AI 답변 생성 횟수를 모두 사용했습니다."
            : ""}
      </p>
    </section>
  );
}
