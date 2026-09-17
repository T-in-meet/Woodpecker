"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { NoteView } from "../schema";
import { buildNotesUrl } from "../utils/buildNotesUrl";

const NOTE_VIEW_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "due", label: "오늘 복습" },
  { value: "scheduled", label: "복습 예정" },
  { value: "completed", label: "학습 종료" },
] as const;

type NotesToolbarProps = { initialQuery: string; activeView: NoteView };

export function NotesToolbar({ initialQuery, activeView }: NotesToolbarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.toString();
  const [query, setQuery] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const composingRef = useRef(false);
  const inputRevisionRef = useRef(0);
  const requestedSearchesRef = useRef(new Map<string, number>());
  const lastUrlRef = useRef(
    buildNotesUrl({
      query: initialQuery,
      view: activeView,
      page: Number(searchParams.get("page")),
    }),
  );

  function cancelSearch() {
    clearTimeout(debounceRef.current);
  }

  useEffect(() => {
    const params = new URLSearchParams(urlQuery);
    const url = buildNotesUrl({
      query: params.get("q") ?? "",
      view: activeView,
      page: Number(params.get("page")),
    });
    const requestedRevision = requestedSearchesRef.current.get(url);
    requestedSearchesRef.current.delete(url);
    // A slow search response must not overwrite text typed since that request.
    if (
      requestedRevision !== undefined &&
      requestedRevision < inputRevisionRef.current
    )
      return;
    cancelSearch();
    setQuery(params.get("q") ?? "");
    lastUrlRef.current = url;
  }, [urlQuery, activeView]);

  useEffect(() => {
    // Browser history changes must cancel the timer before the next route render.
    const onHistory = () => {
      cancelSearch();
      requestedSearchesRef.current.clear();
    };
    const onNavigation = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        link instanceof HTMLAnchorElement &&
        link.target !== "_blank" &&
        !link.hasAttribute("download")
      )
        onHistory();
    };
    window.addEventListener("popstate", onHistory);
    window.addEventListener("pagehide", onHistory);
    document.addEventListener("click", onNavigation, true);
    return () => {
      cancelSearch();
      window.removeEventListener("popstate", onHistory);
      window.removeEventListener("pagehide", onHistory);
      document.removeEventListener("click", onNavigation, true);
    };
  }, []);

  function replaceQuery(value: string) {
    cancelSearch();
    const url = buildNotesUrl({ query: value, view: activeView });
    if (lastUrlRef.current === url) return;
    lastUrlRef.current = url;
    requestedSearchesRef.current.set(url, inputRevisionRef.current);
    router.replace(url, { scroll: false });
  }

  function scheduleQuery(value: string) {
    cancelSearch();
    if (composingRef.current) return;
    debounceRef.current = setTimeout(() => replaceQuery(value), 300);
  }

  function handleQueryChange(event: React.ChangeEvent<HTMLInputElement>) {
    inputRevisionRef.current += 1;
    setQuery(event.target.value);
    scheduleQuery(event.target.value);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!composingRef.current) replaceQuery(query);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (
      event.key !== "Enter" ||
      event.nativeEvent.isComposing ||
      composingRef.current
    )
      return;
    event.preventDefault();
    replaceQuery(query);
  }

  function handleClear() {
    inputRevisionRef.current += 1;
    composingRef.current = false;
    setQuery("");
    replaceQuery("");
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <nav
        aria-label="노트 보기"
        // md 이상은 한 줄로 펼치되, 세로 배치(md~lg)에서 부모 flex-col이
        // 검색창 너비까지 늘리지 않도록 내용만큼만 차지한다.
        className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 md:flex md:w-fit"
      >
        {NOTE_VIEW_OPTIONS.map(({ value, label }) => (
          <Link
            key={value}
            href={buildNotesUrl({ query, view: value })}
            // href가 입력 중인 검색어로 매번 바뀌므로 prefetch하면 키 입력마다
            // 탭 수만큼 서버 요청이 나간다. 실제 이동은 클릭 시에만 한다.
            prefetch={false}
            aria-current={activeView === value ? "page" : undefined}
            onClick={(event) => {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              cancelSearch();
              if (lastUrlRef.current === buildNotesUrl({ query, view: value }))
                event.preventDefault();
            }}
            className={`flex min-h-11 cursor-pointer items-center justify-center whitespace-nowrap rounded-md px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeView === value ? "bg-background font-semibold text-foreground shadow-sm" : "text-muted-foreground hover:bg-background/70 hover:text-foreground"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      {/* form으로 감싸 Enter가 검색을 확정하게 하고, 돋보기를 제출 버튼으로 둔다.
          role="search"로 랜드마크도 준다.
          테두리·모서리·포커스 링을 input이 아니라 이 컨테이너가 갖는다. 그래야
          제출 버튼을 필드 안쪽 오른쪽 끝까지 꽉 채운 블록으로 붙일 수 있다. */}
      <form
        role="search"
        onSubmit={handleSubmit}
        className="flex h-11 w-full min-w-0 items-center rounded-md border border-input bg-background ring-offset-background transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 lg:w-72 lg:flex-none"
      >
        <input
          type="search"
          // 모바일 키보드의 확정 키를 "검색"으로 바꿔 Enter의 의미를 드러낸다.
          enterKeyHint="search"
          value={query}
          onChange={handleQueryChange}
          onCompositionStart={() => {
            composingRef.current = true;
            cancelSearch();
          }}
          onCompositionEnd={(event) => {
            composingRef.current = false;
            inputRevisionRef.current += 1;
            setQuery(event.currentTarget.value);
            scheduleQuery(event.currentTarget.value);
          }}
          name="q"
          autoComplete="off"
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
