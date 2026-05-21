import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { TodayNoteList } from "@/features/notes/components/TodayNoteList";
import { getTodayReviewNotes } from "@/features/notes/queries";
import { NOTES_VIEW_COOKIE } from "@/hooks/useNotesView";
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
    redirect(`${ROUTES.RESEND_EMAIL}?purpose=signup`);
  }

  const cookieStore = await cookies();
  const initialView =
    cookieStore.get(NOTES_VIEW_COOKIE)?.value === "cards" ? "cards" : "list";

  const notes = await getTodayReviewNotes(user.id);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 md:px-12">
      <div className="mb-6 space-y-1">
        <h1 className="text-3xl font-bold text-foreground">오늘의 복습</h1>
        <p className="text-sm text-muted-foreground">
          오늘 복습할 노트만 모았어요.
        </p>
      </div>
      <TodayNoteList notes={notes} initialView={initialView} />
    </div>
  );
}
