import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NoteList } from "@/features/notes/components/NoteList";
import { NotesToolbar } from "@/features/notes/components/NotesToolbar";
import { getNotes } from "@/features/notes/queries";
import { NOTES_VIEW_COOKIE } from "@/hooks/useNotesView";
import {
  NOTES_CARDS_PAGE_SIZE,
  NOTES_LIST_PAGE_SIZE,
} from "@/lib/constants/notes";
import { ROUTES } from "@/lib/constants/routes";
import { createServerComponentClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "노트 목록",
  robots: { index: false, follow: false },
};

type NotesPageProps = {
  searchParams: Promise<{ page?: string; q?: string; view?: string }>;
};

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  if (user.email_confirmed_at == null) {
    redirect(`${ROUTES.RESEND_EMAIL}?purpose=signup`);
  }

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const query = params.q ?? "";
  const cookieStore = await cookies();
  const cookieView =
    cookieStore.get(NOTES_VIEW_COOKIE)?.value === "cards" ? "cards" : "list";
  const view = params.view === "cards" ? "cards" : cookieView;
  const pageSize =
    view === "cards" ? NOTES_CARDS_PAGE_SIZE : NOTES_LIST_PAGE_SIZE;

  const { notes, total } = await getNotes(user.id, page, query, pageSize);

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
          <NotesToolbar initialQuery={query} initialView={view} />
        </Suspense>
      </div>

      <NoteList
        notes={notes}
        total={total}
        currentPage={page}
        pageSize={pageSize}
        view={view}
        query={query}
      />
    </div>
  );
}
