"use client";

import { ChevronDown, ListFilter, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { type NoteView, noteViewSchema } from "../schema";
import { buildNotesUrl } from "../utils/buildNotesUrl";

type NotesToolbarProps = {
  initialQuery: string;
  activeView: NoteView;
};

const NOTE_VIEW_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "due", label: "오늘 복습" },
  { value: "scheduled", label: "복습 예정" },
  { value: "completed", label: "복습 완료" },
] as const satisfies ReadonlyArray<{ value: NoteView; label: string }>;

export function NotesToolbar({ initialQuery, activeView }: NotesToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const activeViewOption =
    NOTE_VIEW_OPTIONS.find(({ value }) => value === activeView) ??
    NOTE_VIEW_OPTIONS[0];
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
      router.push(buildNotesUrl({ query: q, view: activeView }));
    }, 300);
  }

  function handleClear() {
    setQuery("");
    clearTimeout(debounceRef.current);
    router.push(buildNotesUrl({ view: activeView }));
  }

  function handleViewChange(value: string) {
    const parsed = noteViewSchema.safeParse(value);
    if (!parsed.success) return;

    clearTimeout(debounceRef.current);
    isTypingRef.current = false;
    router.push(buildNotesUrl({ query, view: parsed.data }));
  }

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  return (
    <div className="contents sm:flex sm:w-auto sm:items-center sm:gap-2">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="lg"
            aria-label={activeViewOption.label}
            className="justify-self-end rounded-md px-3 data-[state=open]:rounded-b-none data-[state=open]:border-b-transparent data-[state=open]:bg-popover data-[state=open]:text-popover-foreground sm:justify-self-auto"
          >
            <span className="flex items-center gap-1.5">
              <ListFilter className="text-muted-foreground" />
              {activeViewOption.label}
            </span>
            <ChevronDown className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="bottom"
          sideOffset={0}
          avoidCollisions={false}
          className="min-w-(--radix-dropdown-menu-trigger-width) rounded-t-none border border-t-0 border-border ring-0"
        >
          <DropdownMenuLabel>노트 보기</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={activeView}
            onValueChange={handleViewChange}
          >
            {NOTE_VIEW_OPTIONS.map(({ value, label }) => (
              <DropdownMenuRadioItem
                key={value}
                value={value}
                className="cursor-pointer py-2"
              >
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="relative col-span-2 w-full min-w-0 sm:col-auto sm:w-auto sm:flex-none">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={handleQueryChange}
          placeholder="제목 또는 내용 검색"
          className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-8 text-sm outline-none ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:w-64"
        />
        {query ? (
          <button
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
            aria-label="검색어 지우기"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
