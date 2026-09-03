import Link from "next/link";

import { cn } from "@/lib/utils/cn";

const ELLIPSIS = "..." as const;
type PageItem = number | typeof ELLIPSIS;

/**
 * 렌더링할 항목 하나. `coarse`/`fine`은 어느 포인터 환경에서 보이는지를 뜻한다.
 *
 * 터치 타깃을 40px로 키우면 페이지 번호를 전부 늘어놓을 가로 폭이 안 나온다
 * (최대 11개 × 40px + 간격 = 480px > 폰 가용 폭 ≈ 330px). 그래서 터치에서는
 * 1·현재·마지막만 남기고, 사라진 구간에는 생략 표시를 대신 넣는다.
 */
type RenderItem =
  | { kind: "page"; page: number; coarse: boolean }
  | { kind: "ellipsis"; id: string; coarse: boolean; fine: boolean };

type NotesPaginationProps = {
  currentPage: number;
  totalPages: number;
  buildUrl: (page: number) => string;
};

function getPageNumbers(current: number, total: number): PageItem[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: PageItem[] = [1];

  if (current > 3) pages.push(ELLIPSIS);

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push(ELLIPSIS);
  pages.push(total);

  return pages;
}

/**
 * 마우스 기준 페이지 목록에 "터치에서 보이는지" 표시를 붙이고,
 * 터치에서만 필요한 생략 표시를 끼워 넣는다.
 *
 * 마우스 쪽 출력은 건드리지 않는다 — `pages`의 순서와 구성이 그대로 유지되고
 * 새로 넣는 항목은 터치 전용이라 마우스에서는 숨는다.
 */
function getRenderItems(
  pages: PageItem[],
  current: number,
  total: number,
): RenderItem[] {
  const items: RenderItem[] = [];
  let previousCoarsePage: number | null = null;

  for (const [index, entry] of pages.entries()) {
    if (entry === ELLIPSIS) {
      items.push({
        kind: "ellipsis",
        id: `fine-${index}`,
        coarse: false,
        fine: true,
      });
      continue;
    }

    const isCoarseVisible = entry === 1 || entry === total || entry === current;

    // 터치에서 앞 페이지와 번호가 이어지지 않으면 그 사이가 비었다는 표시를 넣는다.
    if (
      isCoarseVisible &&
      previousCoarsePage !== null &&
      entry - previousCoarsePage > 1
    ) {
      items.push({
        kind: "ellipsis",
        id: `coarse-${index}`,
        coarse: true,
        fine: false,
      });
    }

    if (isCoarseVisible) previousCoarsePage = entry;

    items.push({ kind: "page", page: entry, coarse: isCoarseVisible });
  }

  return items;
}

export function NotesPagination({
  currentPage,
  totalPages,
  buildUrl,
}: NotesPaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);
  const items = getRenderItems(pages, currentPage, totalPages);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      aria-label="페이지 탐색"
      className="flex items-center justify-center gap-1 pt-2"
    >
      {/* «·»는 항상 렌더링되는 1·마지막 페이지 링크와 목적지가 같다.
          터치에서는 가로 폭을 벌기 위해 이 중복만 숨긴다. */}
      <PaginationLink
        href={buildUrl(1)}
        disabled={!hasPrev}
        title="첫 페이지"
        aria-label="첫 페이지"
        className="pointer-coarse:hidden"
      >
        «
      </PaginationLink>
      <PaginationLink
        href={buildUrl(currentPage - 1)}
        disabled={!hasPrev}
        title="이전 페이지"
        aria-label="이전 페이지"
      >
        ←
      </PaginationLink>

      {items.map((item) =>
        item.kind === "ellipsis" ? (
          <span
            key={item.id}
            aria-hidden="true"
            className={cn(
              "h-8 w-8 items-center justify-center text-sm text-muted-foreground pointer-coarse:size-10",
              item.fine ? "flex" : "hidden",
              item.coarse ? "pointer-coarse:flex" : "pointer-coarse:hidden",
            )}
          >
            …
          </span>
        ) : (
          <PaginationLink
            key={item.page}
            href={buildUrl(item.page)}
            active={item.page === currentPage}
            aria-label={`${item.page} 페이지`}
            aria-current={item.page === currentPage ? "page" : undefined}
            className={item.coarse ? undefined : "pointer-coarse:hidden"}
          >
            {item.page}
          </PaginationLink>
        ),
      )}

      <PaginationLink
        href={buildUrl(currentPage + 1)}
        disabled={!hasNext}
        title="다음 페이지"
        aria-label="다음 페이지"
      >
        →
      </PaginationLink>
      <PaginationLink
        href={buildUrl(totalPages)}
        disabled={!hasNext}
        title="마지막 페이지"
        aria-label="마지막 페이지"
        className="pointer-coarse:hidden"
      >
        »
      </PaginationLink>
    </nav>
  );
}

type PaginationLinkProps = {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string | undefined;
  "aria-label"?: string;
  "aria-current"?: "page" | undefined;
};

function PaginationLink({
  href,
  children,
  active,
  disabled,
  className,
  ...props
}: PaginationLinkProps) {
  // pointer-coarse: 손가락으로 누를 때만 40px로 키운다. 페이지 이동은 모바일에서
  // 연속으로 누르는 동작이라 32px로는 오조작이 잦다.
  const base =
    "flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-colors pointer-coarse:size-10";

  if (disabled) {
    return (
      <span
        {...props}
        className={cn(
          base,
          "cursor-not-allowed text-muted-foreground/40",
          className,
        )}
        aria-disabled="true"
      >
        {children}
      </span>
    );
  }

  if (active) {
    return (
      <span
        className={cn(
          base,
          "cursor-default bg-foreground text-background",
          className,
        )}
        {...props}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        base,
        "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
