import Link from "next/link";

import { cn } from "@/lib/utils/cn";

import { buildNotesUrl, type NotesView } from "../utils/buildNotesUrl";

const ELLIPSIS = "..." as const;
type PageItem = number | typeof ELLIPSIS;

type NotesPaginationProps = {
  currentPage: number;
  totalPages: number;
  query: string;
  view: NotesView;
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
  query,
  view,
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
        href={buildNotesUrl({ page: currentPage - 1, query, view })}
        disabled={!hasPrev}
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
            href={buildNotesUrl({ page, query, view })}
            active={page === currentPage}
            aria-label={`${page} 페이지`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </PaginationLink>
        ),
      )}

      <PaginationLink
        href={buildNotesUrl({ page: currentPage + 1, query, view })}
        disabled={!hasNext}
        aria-label="다음 페이지"
      >
        →
      </PaginationLink>
    </nav>
  );
}

type PaginationLinkProps = {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
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

  return (
    <Link
      href={href}
      className={cn(
        base,
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
