import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NoteCard } from "@/features/notes/components/NoteCard";
import { getTodayReviewNotes } from "@/features/notes/queries";
import { ROUTES } from "@/lib/constants/routes";
import { createServerComponentClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "오늘의 복습",
  robots: { index: false, follow: false },
};

export default async function TodayReviewPage() {
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  if (user.email_confirmed_at == null) {
    redirect(ROUTES.VERIFY_EMAIL);
  }

  const notes = await getTodayReviewNotes(user.id);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 md:px-12">
      <div className="mb-6 space-y-1">
        <h1 className="text-3xl font-bold text-foreground">오늘의 복습</h1>
        <p className="text-sm text-muted-foreground">
          오늘 복습할 노트만 모았어요.
        </p>
      </div>

      {notes.length === 0 ? (
        <p className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          오늘 예정된 복습이 없습니다.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">총 {notes.length}개</p>
          <ul className="flex list-none flex-col gap-3">
            {notes.map((note) => (
              <li key={note.id}>
                <NoteCard note={note} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
