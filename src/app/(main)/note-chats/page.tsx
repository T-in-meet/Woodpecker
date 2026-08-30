import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NoteChatsClient } from "@/features/note-chats/components/NoteChatsClient";
import { ROUTES } from "@/lib/constants/routes";
import { createServerComponentClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "노트 챗봇",
  robots: { index: false, follow: false },
};

export default async function NoteChatsPage() {
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

  return <NoteChatsClient />;
}
