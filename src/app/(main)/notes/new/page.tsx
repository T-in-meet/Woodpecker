import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NoteForm } from "@/features/notes/components/NoteForm";
import { ROUTES } from "@/lib/constants/routes";
import { createServerComponentClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "새 노트",
  robots: { index: false, follow: false },
};

export default async function NewNotePage() {
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

  return <NoteForm />;
}
