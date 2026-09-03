"use client";

import { ChevronDown, ListFilter, Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
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

  /**
   * 대기 중인 debounce를 버리고 현재 검색어로 즉시 이동한다.
   *
   * Enter를 눌렀는데 300ms를 더 기다리는 건 "입력이 끝났다"는 신호를 무시하는
   * 것이라, 확정 입력은 타이머를 건너뛰고 바로 반영한다.
   */
  function commitQuery() {
    clearTimeout(debounceRef.current);
    isTypingRef.current = false;
    router.push(buildNotesUrl({ query, view: activeView }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    commitQuery();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;

    // 여기서 막지 않으면 form의 암묵적 제출까지 함께 일어나 이동이 두 번 난다.
    event.preventDefault();
    commitQuery();
  }

  function handleClear() {
    setQuery("");
    clearTimeout(debounceRef.current);
    // debounce 타이머를 취소하면 타이머 안의 isTypingRef 해제도 함께 사라지므로
    // 여기서 직접 내려야 이후 URL 변경(뒤로가기 등)이 검색어 상태에 반영된다.
    isTypingRef.current = false;
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
            aria-label={`노트 보기: ${activeViewOption.label}`}
            className="w-36 justify-between justify-self-end rounded-md px-3 data-[state=open]:rounded-b-none data-[state=open]:border-b-transparent data-[state=open]:bg-popover data-[state=open]:text-popover-foreground sm:justify-self-auto"
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
          <DropdownMenuRadioGroup
            value={activeView}
            onValueChange={handleViewChange}
          >
            {NOTE_VIEW_OPTIONS.map(({ value, label }) => (
              <DropdownMenuRadioItem
                key={value}
                value={value}
                className="cursor-pointer whitespace-nowrap py-2"
              >
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* form으로 감싸 Enter가 검색을 확정하게 하고, 돋보기를 제출 버튼으로 둔다.
          role="search"로 랜드마크도 준다.
          테두리·모서리·포커스 링을 input이 아니라 이 컨테이너가 갖는다. 그래야
          제출 버튼을 필드 안쪽 오른쪽 끝까지 꽉 채운 블록으로 붙일 수 있다. */}
      <form
        role="search"
        onSubmit={handleSubmit}
        className="col-span-2 flex h-9 w-full min-w-0 items-center rounded-md border border-input bg-background ring-offset-background transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 sm:col-auto sm:w-72 sm:flex-none"
      >
        <input
          type="search"
          // 모바일 키보드의 확정 키를 "검색"으로 바꿔 Enter의 의미를 드러낸다.
          enterKeyHint="search"
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          aria-label="노트 검색"
          placeholder="제목 또는 내용 검색"
          // 테두리와 포커스 링은 form이 그리므로 여기서는 배경까지 비운다.
          // type=search의 브라우저 기본 지우기 버튼은 아래 X 버튼과 중복이라 숨긴다.
          className="h-full min-w-0 flex-1 bg-transparent pl-3 pr-1 text-sm outline-none [&::-webkit-search-cancel-button]:hidden placeholder:text-muted-foreground"
        />

        {/* 조작부는 필드 끝에 지우기 → 검색 순서로 둔다. 제출은 입력의 마지막 자리에
            오는 게 관례라(네이버·아마존 등) 선행 아이콘보다 눌러볼 확률이 높다.
            두 버튼 모두 세로만 ::after로 44px까지 넓힌다 — 가로로 퍼뜨리면 서로,
            그리고 입력 텍스트 영역과 겹쳐 탭을 가로챈다. 위아래 4px 넘침은
            그리드 gap(12px) 안이라 겹칠 요소가 없다. */}
        {query ? (
          <button
            // form 안에서는 type 생략 시 submit이 되므로 명시한다.
            type="button"
            onClick={handleClear}
            aria-label="검색어 지우기"
            className="relative flex h-full w-9 shrink-0 cursor-pointer items-center justify-center text-muted-foreground outline-none after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {/* 아이콘만 두면 누를 수 있는 것으로 읽히지 않는다. 배경을 채운 블록과
            구분선으로 분리해 눌리는 요소임을 형태와 대비로 알린다.
            모서리 반경은 form의 rounded-md에서 테두리 1px을 뺀 값이라야 안쪽에
            정확히 맞물린다. */}
        <button
          type="submit"
          aria-label="검색"
          className="relative flex h-full w-10 shrink-0 cursor-pointer items-center justify-center rounded-r-[calc(var(--radius-md)-1px)] border-l border-input bg-muted text-muted-foreground outline-none transition-colors after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset hover:bg-muted/70 hover:text-foreground"
        >
          <Search aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
