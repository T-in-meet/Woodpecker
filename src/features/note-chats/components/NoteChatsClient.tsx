"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { useNoteChatConversationListQuery } from "../hooks/use-note-chat-conversation-list-query";
import { NoteChatBreadcrumb } from "./NoteChatBreadcrumb";
import { NoteChatConversationList } from "./NoteChatConversationList";
import { NoteChatConversationSearch } from "./NoteChatConversationSearch";
import { NoteChatCreateDialog } from "./NoteChatCreateDialog";

/**
 * 노트 챗봇 대화 목록 화면을 렌더링합니다.
 */
export function NoteChatsClient() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useNoteChatConversationListQuery({
    page,
    search,
  });

  const conversations = data?.items ?? [];

  const handleSearch = (value: string) => {
    setPage(1);
    setSearch(value);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <NoteChatBreadcrumb />
      <div>
        <h1 className="text-3xl font-semibold">노트 챗봇</h1>

        <p className="mt-1 text-sm text-muted-foreground">
          저장한 노트를 바탕으로 질문하고 답변을 확인해 보세요.
        </p>
      </div>

      <section className="min-h-[calc(100vh-220px)] overflow-hidden rounded-lg border">
        <div className="flex items-center justify-between  px-5 py-4">
          <h2 className="text-lg font-semibold">대화 목록</h2>

          <NoteChatCreateDialog />
        </div>

        <div className=" p-4">
          <NoteChatConversationSearch value={search} onSearch={handleSearch} />
        </div>

        <div className="p-2">
          {isLoading ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">
              대화 목록을 불러오는 중입니다.
            </p>
          ) : isError ? (
            <p className="px-3 py-6 text-sm text-destructive">
              대화 목록을 불러오지 못했습니다.
            </p>
          ) : (
            <NoteChatConversationList
              conversations={conversations}
              isSearching={search.length > 0}
            />
          )}
        </div>

        {data && data.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={page <= 1}
              aria-label="이전 대화 목록"
              onClick={() => {
                setPage((current) => Math.max(1, current - 1));
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>

            <p className="text-xs text-muted-foreground">
              {data.page} / {data.totalPages}
            </p>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={page >= data.totalPages}
              aria-label="다음 대화 목록"
              onClick={() => {
                setPage((current) => Math.min(data.totalPages, current + 1));
              }}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
