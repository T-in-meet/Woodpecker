import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NoteForm } from "@/features/notes/components/NoteForm";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "새 노트",
  robots: { index: false, follow: false },
};

export default async function NewNotePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // if (!user) {
  //   redirect(ROUTES.LOGIN);
  // }

  return <NoteForm />;
}
