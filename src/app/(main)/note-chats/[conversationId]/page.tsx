import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NoteChatConversationClient } from "@/features/note-chats/components/NoteChatConversationClient";
import { ROUTES } from "@/lib/constants/routes";
import { createServerComponentClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "노트 챗봇",
  robots: { index: false, follow: false },
};

type NoteChatConversationPageProps = {
  params: Promise<{
    conversationId: string;
  }>;
};

export default async function NoteChatConversationPage({
  params,
}: NoteChatConversationPageProps) {
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

  const { conversationId } = await params;

  return <NoteChatConversationClient conversationId={conversationId} />;
}
