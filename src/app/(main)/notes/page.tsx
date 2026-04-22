import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { NoteList } from "@/features/notes/components/NoteList";
import { getNotes } from "@/features/notes/queries";
import { ROUTES } from "@/lib/constants/routes";
import { createServerComponentClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "기록 목록",
  robots: { index: false, follow: false },
};

export default async function NotesPage() {
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

  const notes = await getNotes(user.id);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 md:px-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">기록 목록</h1>
          <p className="text-sm text-muted-foreground">
            저장한 노트를 확인하고 다음 복습을 이어가세요.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href={ROUTES.NOTES_NEW}>새 노트</Link>
        </Button>
      </div>

      <NoteList notes={notes} />
    </div>
  );
}
