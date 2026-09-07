import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { acceptLegalDocumentsAction } from "@/features/auth/agreements/actions/acceptLegalDocumentsAction";
import { LegalAcceptanceForm } from "@/features/auth/agreements/components/LegalAcceptanceForm";
import { getLegalAcceptanceStatus } from "@/features/auth/lib/userAgreements";
import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";
import { ROUTES } from "@/lib/constants/routes";
import { getUser } from "@/lib/supabase/getUser";

/* 접미사를 직접 붙이지 않는다. 루트 레이아웃의 title.template이 "%s | 딱다구리"로
   조합하므로, 여기에 브랜드를 적으면 "법적 문서 확인 | 딱다구리 | 딱다구리"가 된다. */
export const metadata: Metadata = {
  title: "법적 문서 확인",
  robots: { index: false, follow: false },
};

type AgreementsPageProps = {
  searchParams: Promise<{ redirect?: string | string[] }>;
};

export default async function AgreementsPage({
  searchParams,
}: AgreementsPageProps) {
  const user = await getUser();
  if (!user) redirect(ROUTES.LOGIN);

  if (!user.email_confirmed_at) {
    const query = new URLSearchParams({ purpose: "signup" });
    if (user.email) query.set("email", user.email);
    redirect(`${ROUTES.RESEND_EMAIL}?${query.toString()}`);
  }

  const { redirect: rawRedirect } = await searchParams;
  const redirectPath = validateRedirectPath(rawRedirect);
  const status = await getLegalAcceptanceStatus(user.id);

  if (status.isComplete) redirect(redirectPath);

  const action = acceptLegalDocumentsAction.bind(null, redirectPath);

  return (
    <main className="md:flex md:min-h-[calc(100dvh-4.5rem)] md:items-center md:justify-center">
      <LegalAcceptanceForm action={action} isEnforced={status.isEnforced} />
    </main>
  );
}
