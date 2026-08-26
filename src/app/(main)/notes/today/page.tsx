import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NotesPagination } from "@/features/notes/components/NotesPagination";
import { TodayNoteList } from "@/features/notes/components/TodayNoteList";
import { getTodayReviewNotes } from "@/features/notes/queries";
import { TODAY_PAGE_SIZE } from "@/lib/constants/notes";
import { ROUTES } from "@/lib/constants/routes";
import { createServerComponentClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "오늘의 복습",
  robots: { index: false, follow: false },
};

type TodayReviewPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function TodayReviewPage({
  searchParams,
}: TodayReviewPageProps) {
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
  const rawPage = Number(params.page);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;

  const { notes, total } = await getTodayReviewNotes(
    user.id,
    page,
    TODAY_PAGE_SIZE,
  );
  const totalPages = Math.ceil(total / TODAY_PAGE_SIZE);

  if (total > 0 && page > totalPages) {
    const lastPage = totalPages;
    redirect(
      lastPage === 1
        ? ROUTES.NOTES_TODAY
        : `${ROUTES.NOTES_TODAY}?page=${lastPage}`,
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 md:px-12">
      <div className="mb-6 space-y-1">
        <h1 className="text-3xl font-bold text-foreground">오늘의 복습</h1>
        <p className="text-sm text-muted-foreground">
          오늘 복습할 노트만 모았어요.
        </p>
      </div>
      <TodayNoteList notes={notes} total={total} />
      <NotesPagination
        currentPage={page}
        totalPages={totalPages}
        buildUrl={(p) =>
          p === 1 ? ROUTES.NOTES_TODAY : `${ROUTES.NOTES_TODAY}?page=${p}`
        }
      />
    </div>
  );
}
