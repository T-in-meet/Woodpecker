import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NotesToolbar } from "@/features/notes/components/NotesToolbar";
import { NotesViewContainer } from "@/features/notes/components/NotesViewContainer";
import { getNotes } from "@/features/notes/queries";
import { buildNotesUrl } from "@/features/notes/utils/buildNotesUrl";
import { NOTES_PAGE_SIZE } from "@/lib/constants/notes";
import { ROUTES } from "@/lib/constants/routes";
import { getUser } from "@/lib/supabase/getUser";

export const metadata: Metadata = {
  title: "노트 목록",
  robots: { index: false, follow: false },
};

type NotesPageProps = {
  searchParams: Promise<{ page?: string; q?: string }>;
};

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const user = await getUser();

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  if (user.email_confirmed_at == null) {
    redirect(`${ROUTES.RESEND_EMAIL}?purpose=signup`);
  }

  const params = await searchParams;
  const rawPage = Number(params.page);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
  const query = params.q ?? "";

  const { notes, total } = await getNotes(
    user.id,
    page,
    query,
    NOTES_PAGE_SIZE,
  );
  const totalPages = Math.ceil(total / NOTES_PAGE_SIZE);

  if (total > 0 && page > totalPages) {
    redirect(buildNotesUrl({ page: totalPages, query }));
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 md:px-12">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">노트 목록</h1>
          <p className="text-sm text-muted-foreground">
            저장한 노트를 확인하고 다음 복습을 이어가세요.
          </p>
        </div>
        <Suspense>
          <NotesToolbar initialQuery={query} />
        </Suspense>
      </div>

      <NotesViewContainer
        notes={notes}
        total={total}
        currentPage={page}
        pageSize={NOTES_PAGE_SIZE}
        query={query}
      />
    </div>
  );
}
