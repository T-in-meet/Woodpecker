"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Link } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/lib/constants/routes";

import { noteChatQueryKeys } from "../constants/query-keys";
import { useNoteChatConversationDetailQuery } from "../hooks/use-note-chat-conversation-query";
import { useNoteChatStream } from "../hooks/use-note-chat-stream";
import { NoteChatComposer } from "./NoteChatComposer";
import { NoteChatConversationMenu } from "./NoteChatConversationMenu";
import { NoteChatConversationSidebar } from "./NoteChatConversationSidebar";
import { NoteChatMessageList } from "./NoteChatMessageList";

type NoteChatConversationClientProps = {
  conversationId: string;
};

/**
 * 선택한 노트 챗봇 Conversation 화면을 렌더링합니다.
 */
export function NoteChatConversationClient({
  conversationId,
}: NoteChatConversationClientProps) {
  const queryClient = useQueryClient();

  const messageEndRef = useRef<HTMLDivElement | null>(null);

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

  const {
    cancel,
    content: streamingContent,
    error: streamError,
    isStreaming,
    start,
    update,
  } = useNoteChatStream();

  const conversationQuery = useNoteChatConversationDetailQuery(conversationId);

  const detail = conversationQuery.data;

  /**
   * 새로운 질문을 전송하고 스트리밍 완료 후
   * Conversation 상세와 목록 데이터를 다시 조회합니다.
   */
  const handleQuestionSubmit = async (question: string) => {
    setPendingQuestion(question);

    try {
      await start({
        conversationId,
        question,
      });
    } finally {
      /*
       * 질문 Route가 User Message를 먼저 저장하고,
       * 성공 시 Assistant Message까지 저장하므로
       * 스트림 종료 후 서버 상태를 다시 가져옵니다.
       */
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: noteChatQueryKeys.conversationDetail(conversationId),
        }),
        queryClient.invalidateQueries({
          queryKey: noteChatQueryKeys.conversationLists(),
        }),
      ]);

      setPendingQuestion(null);
    }
  };

  /**
   * 기존 사용자 질문을 수정하고 해당 질문 이후의 화면을
   * 새로운 대화 흐름으로 교체합니다.
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

    try {
      await update({
        messageId,
        question,
      });
    } finally {
      /*
       * 수정 Route가 User Message 수정과 이후 Message 삭제,
       * 새 Assistant Message 저장까지 처리하므로
       * 스트림 종료 후 Conversation 데이터를 다시 조회합니다.
       */
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: noteChatQueryKeys.conversationDetail(conversationId),
        }),
        queryClient.invalidateQueries({
          queryKey: noteChatQueryKeys.conversationLists(),
        }),
      ]);

      setEditingSequenceNumber(null);
      setPendingQuestion(null);
    }
  };

  /**
   * 새 질문, 수정 질문, 스트리밍 답변이 추가될 때
   * 메시지 영역을 최신 메시지 위치로 이동합니다.
   */
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [
    detail?.messages.length,
    pendingQuestion,
    streamingContent,
    editingSequenceNumber,
  ]);

  const visibleMessages =
    detail && editingSequenceNumber !== null
      ? detail.messages.filter(
          (message) => message.sequence_number < editingSequenceNumber,
        )
      : (detail?.messages ?? []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col px-4 py-6 md:px-12 md:py-10">
      <div className="grid min-h-[calc(100dvh-10rem)] overflow-hidden rounded-lg border md:grid-cols-[280px_minmax(0,1fr)]">
        <NoteChatConversationSidebar selectedConversationId={conversationId} />

        <section className="flex min-h-0 min-w-0 flex-col">
          {conversationQuery.isLoading ? (
            <ConversationDetailSkeleton />
          ) : conversationQuery.isError ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="space-y-4 text-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    대화를 불러오지 못했습니다.
                  </p>

                  <p className="text-sm text-muted-foreground">
                    잠시 후 다시 시도해 주세요.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={conversationQuery.isFetching}
                  onClick={() => {
                    void conversationQuery.refetch();
                  }}
                >
                  {conversationQuery.isFetching
                    ? "다시 불러오는 중..."
                    : "다시 시도"}
                </Button>
              </div>
            </div>
          ) : !detail ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <div className="space-y-4 text-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    대화를 찾을 수 없습니다.
                  </p>

                  <p className="text-sm text-muted-foreground">
                    삭제되었거나 접근할 수 없는 대화입니다.
                  </p>
                </div>

                <Button asChild variant="outline">
                  <Link href={ROUTES.NOTE_CHATS}>대화 목록으로 돌아가기</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center justify-between gap-4 border-b px-4 py-3 md:px-6 md:py-4">
                <h1 className="min-w-0 truncate text-base font-semibold md:text-lg">
                  {detail.conversation.title}
                </h1>

                <NoteChatConversationMenu
                  conversationId={detail.conversation.id}
                  title={detail.conversation.title}
                />
              </div>

              <ScrollArea className="min-h-0 flex-1">
                <NoteChatMessageList
                  assistantSources={detail.assistantSources}
                  messages={visibleMessages}
                  pendingQuestion={pendingQuestion}
                  streamingContent={streamingContent}
                  streamError={streamError}
                  isStreaming={isStreaming}
                  onUpdateQuestion={handleQuestionUpdate}
                />

                <div ref={messageEndRef} />
              </ScrollArea>

              <div className="shrink-0 border-t bg-background p-3 md:p-4">
                <NoteChatComposer
                  conversationId={conversationId}
                  isStreaming={isStreaming}
                  onCancel={cancel}
                  onSubmit={handleQuestionSubmit}
                />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * Conversation 상세 조회 중 표시할 Skeleton입니다.
 */
function ConversationDetailSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b px-6 py-4">
        <Skeleton className="h-6 w-48" />
      </div>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex justify-end">
          <Skeleton className="h-16 w-2/3 rounded-2xl" />
        </div>

        <div className="flex justify-start">
          <Skeleton className="h-24 w-3/4 rounded-2xl" />
        </div>

        <div className="flex justify-end">
          <Skeleton className="h-16 w-1/2 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
