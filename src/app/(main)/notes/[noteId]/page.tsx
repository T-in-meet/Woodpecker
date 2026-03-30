import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { NoteViewer } from "@/features/notes/components/NoteViewer";
import { getNoteById } from "@/features/notes/queries";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils/formatDate";

export const metadata: Metadata = {
  title: "노트 상세",
  robots: { index: false, follow: false },
};

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.LOGIN);
  }

  const note = await getNoteById(noteId, user.id);

  if (!note) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10 md:px-12">
      <header className="border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-1 font-medium text-foreground">
            {note.language ?? "markdown"}
          </span>
          <span>마지막 수정 {formatDateTime(note.updated_at)}</span>
        </div>
        <h1 className="mt-4 text-3xl font-bold text-foreground">
          {note.title}
        </h1>
      </header>

      <NoteViewer
        content={note.content}
        language={note.language}
        className="min-h-[60vh] py-6"
      />
    </div>
  );
}
