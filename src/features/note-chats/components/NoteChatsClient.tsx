"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { useNoteChatConversationListQuery } from "../hooks/use-note-chat-conversation-list-query";
import { NoteChatBreadcrumb } from "./NoteChatBreadcrumb";
import { NoteChatConversationList } from "./NoteChatConversationList";
import { NoteChatConversationSearch } from "./NoteChatConversationSearch";
import { NoteChatCreateDialog } from "./NoteChatCreateDialog";

export function NoteChatsClient() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);

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

  /**
   * 컨테이너 시작 위치부터 viewport 하단까지의
   * 실제 사용 가능 높이를 계산합니다.
   * (layout.tsx를 수정할 수 없어 남은 공간을 직접 측정합니다.
   *  NoteChatConversationClient와 동일한 패턴입니다.)
   */
  useEffect(() => {
    const updateHeight = () => {
      const el = containerRef.current;
      if (!el) return;

      const top = el.getBoundingClientRect().top;
      setContainerHeight(Math.max(0, window.innerHeight - top));
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  return (
    <div
      ref={containerRef}
      className="mx-auto flex w-full max-w-6xl flex-col space-y-6 px-4 pb-4 sm:px-6 sm:pb-6"
      style={containerHeight !== null ? { height: containerHeight } : undefined}
    >
      <div className="shrink-0">
        <NoteChatBreadcrumb className="my-4" />
        <div>
          <h1 className="text-3xl font-semibold">노트 챗봇</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            저장한 노트를 바탕으로 질문하고 답변을 확인해 보세요.
          </p>
        </div>
      </div>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="flex shrink-0 items-center justify-between px-5 py-4">
          <h2 className="text-lg font-semibold">대화 목록</h2>
          <NoteChatCreateDialog />
        </div>

        <div className="shrink-0 px-4 py-2">
          <NoteChatConversationSearch value={search} onSearch={handleSearch} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
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
          <div className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={page <= 1}
              aria-label="이전 대화 목록"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
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
              onClick={() =>
                setPage((current) => Math.min(data.totalPages, current + 1))
              }
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
