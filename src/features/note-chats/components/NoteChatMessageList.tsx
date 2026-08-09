"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AI_CHAT_MESSAGE_ROLE } from "@/features/ai/chats/constants";

import {
  noteChatAssistantMessageContentSchema,
  noteChatUserMessageContentSchema,
} from "../schema";
import type { NoteChatAssistantSources, NoteChatMessage } from "../types";
import { NoteChatReferenceNotes } from "./NoteChatReferenceNotes";

type NoteChatMessageListProps = {
  assistantSources: NoteChatAssistantSources[];

  messages: NoteChatMessage[];

  /** 아직 Query에 반영되지 않은 현재 사용자 질문입니다. */
  pendingQuestion?: string | null;

  /** 현재 스트리밍 중인 Assistant 답변입니다. */
  streamingContent?: string;

  /** 현재 스트리밍 오류입니다. */
  streamError?: string | null;

  /** 답변 생성이 진행 중인지 여부입니다. */
  isStreaming?: boolean;

  /** 기존 사용자 질문을 수정하고 다시 실행합니다. */
  onUpdateQuestion: (params: {
    messageId: string;
    question: string;
    sequenceNumber: number;
  }) => Promise<void>;
};

/**
 * 저장된 메시지와 현재 진행 중인 노트 챗봇 메시지를 표시합니다.
 */
export function NoteChatMessageList({
  assistantSources,
  messages,
  pendingQuestion = null,
  streamingContent = "",
  streamError = null,
  isStreaming = false,
  onUpdateQuestion,
}: NoteChatMessageListProps) {
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    sequenceNumber: number;
    text: string;
  } | null>(null);

  const [editingQuestion, setEditingQuestion] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const sourcesByAssistantMessageId = new Map(
    assistantSources.map((item) => [item.assistantMessageId, item.sources]),
  );

  const hasTransientMessage =
    pendingQuestion !== null ||
    streamingContent.length > 0 ||
    isStreaming ||
    streamError !== null;

  if (messages.length === 0 && !hasTransientMessage) {
    return (
      <div className="flex min-h-80 items-center justify-center px-6 py-12">
        <div className="max-w-md space-y-3 text-center">
          <div className="space-y-1">
            <p className="text-lg font-semibold">무엇이 궁금한가요?</p>

            <p className="text-sm leading-6 text-muted-foreground">
              저장한 노트를 바탕으로 질문해 보세요. 관련된 노트를 찾아 답변을
              만들어 드립니다.
            </p>
          </div>

          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-left">
            <p className="text-xs font-medium text-muted-foreground">예시</p>

            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>• 내가 정리한 React Query 내용을 설명해줘.</li>
              <li>• 이 주제와 관련된 노트들을 비교해줘.</li>
              <li>• 이전에 공부한 내용을 간단히 복습시켜줘.</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const handleUpdate = async () => {
    if (!editingMessage) {
      return;
    }

    const question = editingQuestion.trim();

    if (!question || question === editingMessage.text.trim()) {
      return;
    }

    setIsUpdating(true);
    setUpdateError(null);

    try {
      await onUpdateQuestion({
        messageId: editingMessage.id,
        question,
        sequenceNumber: editingMessage.sequenceNumber,
      });

      setEditingMessage(null);
      setEditingQuestion("");
    } catch (error) {
      setUpdateError(
        error instanceof Error ? error.message : "질문 수정에 실패했습니다.",
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const closeEditDialog = () => {
    if (isUpdating) {
      return;
    }

    setEditingMessage(null);
    setEditingQuestion("");
    setUpdateError(null);
  };

  return (
    <>
      <ul className="flex list-none flex-col gap-6 px-4 py-6 md:px-6">
        {messages.map((message) => {
          if (message.role === AI_CHAT_MESSAGE_ROLE.USER) {
            const parsed = noteChatUserMessageContentSchema.safeParse(
              message.content,
            );

            if (!parsed.success) {
              return null;
            }

            return (
              <li key={message.id} className="group flex justify-end">
                <div className="flex max-w-[85%] items-start gap-1 md:max-w-[75%]">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                    aria-label="질문 수정"
                    disabled={isStreaming}
                    onClick={() => {
                      setEditingMessage({
                        id: message.id,
                        sequenceNumber: message.sequence_number,
                        text: parsed.data.text,
                      });

                      setEditingQuestion(parsed.data.text);
                      setUpdateError(null);
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>

                  <div className="rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm leading-7 text-primary-foreground">
                    <p className="whitespace-pre-wrap">{parsed.data.text}</p>
                  </div>
                </div>
              </li>
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
              <li key={message.id} className="flex justify-start">
                <div className="max-w-[90%] space-y-3 md:max-w-[80%]">
                  <div className="rounded-2xl rounded-bl-sm border bg-muted/40 px-4 py-3 text-sm leading-7">
                    <p className="whitespace-pre-wrap">{parsed.data.text}</p>
                  </div>

                  <NoteChatReferenceNotes
                    sources={sourcesByAssistantMessageId.get(message.id) ?? []}
                    usedNoteIds={parsed.data.usedNoteIds}
                  />
                </div>
              </li>
            );
          }

          return null;
        })}

        {pendingQuestion ? (
          <li className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-sm leading-7 text-primary-foreground md:max-w-[75%]">
              <p className="whitespace-pre-wrap">{pendingQuestion}</p>
            </div>
          </li>
        ) : null}

        {streamingContent.length > 0 ? (
          <li className="flex justify-start">
            <div className="max-w-[90%] md:max-w-[80%]">
              <div
                aria-live="polite"
                className="rounded-2xl rounded-bl-sm border bg-muted/40 px-4 py-3 text-sm leading-7"
              >
                <p className="whitespace-pre-wrap">{streamingContent}</p>
              </div>
            </div>
          </li>
        ) : isStreaming ? (
          <li className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border bg-muted/40 px-4 py-3">
              <p className="text-sm text-muted-foreground">
                답변을 생성하고 있습니다...
              </p>
            </div>
          </li>
        ) : null}

        {streamError ? (
          <li className="flex justify-start">
            <p role="alert" className="text-sm text-destructive">
              {streamError}
            </p>
          </li>
        ) : null}
      </ul>

      <Dialog
        open={editingMessage !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeEditDialog();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>질문 수정</DialogTitle>

            <DialogDescription>
              이 질문을 수정하면 이후 대화는 삭제되고 수정된 질문으로 새로운
              답변을 생성합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Textarea
              value={editingQuestion}
              disabled={isUpdating}
              rows={5}
              onChange={(event) => {
                setEditingQuestion(event.target.value);
              }}
            />

            {updateError ? (
              <p role="alert" className="text-sm text-destructive">
                {updateError}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isUpdating}
              onClick={closeEditDialog}
            >
              취소
            </Button>

            <Button
              type="button"
              disabled={
                isUpdating ||
                editingQuestion.trim().length === 0 ||
                editingQuestion.trim() === editingMessage?.text.trim()
              }
              onClick={() => {
                void handleUpdate();
              }}
            >
              {isUpdating ? "수정 중..." : "수정하고 다시 답변받기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
