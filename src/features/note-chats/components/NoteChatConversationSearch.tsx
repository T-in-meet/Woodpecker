"use client";

import { Search } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";

type NoteChatConversationSearchProps = {
  value: string;
  onSearch: (value: string) => void;
};

/**
 * 노트 챗봇 Conversation 제목 검색 입력창을 제공합니다.
 */
export function NoteChatConversationSearch({
  value,
  onSearch,
}: NoteChatConversationSearchProps) {
  const [searchInput, setSearchInput] = useState(value);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    onSearch(searchInput.trim());
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="relative">
        <button
          type="submit"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="대화 검색"
        >
          <Search className="size-4" />
        </button>

        <Input
          type="search"
          enterKeyHint="search"
          value={searchInput}
          onChange={(event) => {
            const nextValue = event.target.value;

            setSearchInput(nextValue);

            // 검색어를 모두 지우면 기본 Conversation 목록으로 돌아갑니다.
            if (nextValue === "") {
              onSearch("");
            }
          }}
          placeholder="대화 제목 검색"
          className="pl-9"
        />
      </div>
    </form>
  );
}
