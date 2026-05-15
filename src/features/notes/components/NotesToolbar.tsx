"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useNotesView } from "@/hooks/useNotesView";

import { buildNotesUrl, type NotesView as View } from "../utils/buildNotesUrl";
import { ViewToggle } from "./ViewToggle";

type NotesToolbarProps = {
  initialQuery: string;
  initialView: View;
};

export function NotesToolbar({ initialQuery, initialView }: NotesToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [view, updateView] = useNotesView(initialView);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const isTypingRef = useRef(false);

  // URL이 변경되면 검색어 상태 동기화
  useEffect(() => {
    if (isTypingRef.current) return;
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  function handleQueryChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    isTypingRef.current = true;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      isTypingRef.current = false;
      router.push(buildNotesUrl({ query: q, view }));
    }, 300);
  }

  function handleClear() {
    setQuery("");
    clearTimeout(debounceRef.current);
    router.push(buildNotesUrl({ view }));
  }

  function handleViewChange(v: View) {
    clearTimeout(debounceRef.current);
    updateView(v);
    router.push(buildNotesUrl({ query, view: v }));
  }

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div className="flex items-center gap-2">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={handleQueryChange}
          placeholder="제목 또는 내용 검색"
          className="h-9 w-56 rounded-md border border-input bg-background pl-8 pr-8 text-sm outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-64"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
            aria-label="검색어 지우기"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* View toggle */}
      <ViewToggle view={view} onChange={handleViewChange} />
    </div>
  );
}
