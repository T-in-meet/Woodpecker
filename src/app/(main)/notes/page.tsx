import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NotesToolbar } from "@/features/notes/components/NotesToolbar";
import { NotesViewContainer } from "@/features/notes/components/NotesViewContainer";
import { getNotes } from "@/features/notes/queries";
import { noteViewSchema } from "@/features/notes/schema";
import { buildNotesUrl } from "@/features/notes/utils/buildNotesUrl";
import { NOTES_PAGE_SIZE } from "@/lib/constants/notes";
import { ROUTES } from "@/lib/constants/routes";
import { getUser } from "@/lib/supabase/getUser";

export const metadata: Metadata = {
  title: "노트 목록",
  robots: { index: false, follow: false },
};

type NotesPageProps = {
  searchParams: Promise<{ page?: string; q?: string; view?: string }>;
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
  const parsedView = noteViewSchema.safeParse(params.view);
  const view = parsedView.success ? parsedView.data : "all";

  const { notes, total } = await getNotes(
    user.id,
    page,
    query,
    NOTES_PAGE_SIZE,
    view,
  );
  const totalPages = Math.ceil(total / NOTES_PAGE_SIZE);

  if (total > 0 && page > totalPages) {
    redirect(buildNotesUrl({ page: totalPages, query, view }));
  }

  return (
    <div className="-mb-8 mx-auto w-full max-w-5xl px-6 pb-2 pt-10 md:mb-0 md:px-12 md:py-10">
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 sm:flex sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">노트 목록</h1>
        </div>
        <Suspense>
          <NotesToolbar initialQuery={query} activeView={view} />
        </Suspense>
      </div>

      <NotesViewContainer
        notes={notes}
        total={total}
        currentPage={page}
        pageSize={NOTES_PAGE_SIZE}
        query={query}
        view={view}
      />
    </div>
  );
}
