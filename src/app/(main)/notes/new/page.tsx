import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NoteForm } from "@/features/notes/components/NoteForm";
import { ROUTES } from "@/lib/constants/routes";
import { createServerComponentClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "노트 작성",
  robots: { index: false, follow: false },
};

/**
 * Note 생성 후 after()에서 실행되는 embedding 후처리 시간을 확보합니다.
 */
export const maxDuration = 90;

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
