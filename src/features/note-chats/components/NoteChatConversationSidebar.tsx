"use client";

import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

import { useNoteChatConversationListQuery } from "../hooks/use-note-chat-conversation-list-query";
import { NoteChatConversationList } from "./NoteChatConversationList";
import { NoteChatCreateDialog } from "./NoteChatCreateDialog";

type NoteChatConversationSidebarProps = {
  selectedConversationId?: string;
};

/**
 * 노트 챗봇 Conversation 목록, 검색 및 페이지 이동을 제공합니다.
 */
export function NoteChatConversationSidebar({
  selectedConversationId,
}: NoteChatConversationSidebarProps) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const conversationListQuery = useNoteChatConversationListQuery({
    page,
    search,
  });

  const result = conversationListQuery.data;

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <aside className="flex max-h-72 min-h-0 flex-col border-b md:max-h-none md:border-r md:border-b-0">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <p className="text-sm font-medium">대화 목록</p>

        <NoteChatCreateDialog />
      </div>

      <form className="shrink-0 border-b p-3" onSubmit={handleSearchSubmit}>
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
            }}
            className="pl-9"
            placeholder="대화 제목 검색"
          />
        </div>
      </form>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-2">
          {conversationListQuery.isLoading ? (
            <ConversationListSkeleton />
          ) : conversationListQuery.isError ? (
            <div className="space-y-3 px-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                대화 목록을 불러오지 못했습니다.
              </p>

              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={conversationListQuery.isFetching}
                onClick={() => {
                  void conversationListQuery.refetch();
                }}
              >
                {conversationListQuery.isFetching
                  ? "불러오는 중..."
                  : "다시 시도"}
              </Button>
            </div>
          ) : (
            <NoteChatConversationList
              conversations={result?.items ?? []}
              isSearching={search.length > 0}
              {...(selectedConversationId ? { selectedConversationId } : {})}
            />
          )}
        </div>
      </ScrollArea>

      {result && result.totalPages > 1 ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2">
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
            {result.page} / {result.totalPages}
          </p>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            disabled={page >= result.totalPages}
            aria-label="다음 대화 목록"
            onClick={() => {
              setPage((current) => Math.min(result.totalPages, current + 1));
            }}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </aside>
  );
}

/**
 * Conversation 목록 조회 중 표시할 Skeleton입니다.
 */
function ConversationListSkeleton() {
  return (
    <div className="space-y-2 px-1">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="space-y-2 rounded-md px-3 py-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}
