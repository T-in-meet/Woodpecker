import Link from "next/link";

import { cn } from "@/lib/utils/cn";

const ELLIPSIS = "..." as const;
type PageItem = number | typeof ELLIPSIS;

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

export function NotesPagination({
  currentPage,
  totalPages,
  buildUrl,
}: NotesPaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      aria-label="페이지 탐색"
      className="flex items-center justify-center gap-1 pt-2"
    >
      <PaginationLink
        href={buildUrl(1)}
        disabled={!hasPrev}
        title="첫 페이지"
        aria-label="첫 페이지"
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

      {pages.map((page, i) =>
        page === ELLIPSIS ? (
          <span
            key={`ellipsis-${i}`}
            className="flex h-8 w-8 items-center justify-center text-sm text-muted-foreground"
          >
            …
          </span>
        ) : (
          <PaginationLink
            key={page}
            href={buildUrl(page)}
            active={page === currentPage}
            aria-label={`${page} 페이지`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
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
  "aria-label"?: string;
  "aria-current"?: "page" | undefined;
};

function PaginationLink({
  href,
  children,
  active,
  disabled,
  ...props
}: PaginationLinkProps) {
  const base =
    "flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-colors";

  if (disabled) {
    return (
      <span
        className={cn(base, "cursor-not-allowed text-muted-foreground/40")}
        aria-disabled="true"
      >
        {children}
      </span>
    );
  }

  if (active) {
    return (
      <span
        className={cn(base, "cursor-default bg-foreground text-background")}
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
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
