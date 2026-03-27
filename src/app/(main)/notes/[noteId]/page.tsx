import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
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

  return (
    <div className="mx-auto w-full max-w-4xl px-12 py-16">
      <h1 className="text-3xl font-bold text-foreground">기록 상세</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        기록 상세 페이지는 아직 구현 중입니다.
      </p>
    </div>
  );
}
