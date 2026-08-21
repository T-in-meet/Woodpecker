import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Header, HeaderSkeleton } from "@/components/layout/Header";
import { getAgreementRequiredPath } from "@/features/auth/constants/agreementRequired";
import { getLegalAcceptanceStatus } from "@/features/auth/lib/userAgreements";
import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";
import {
  formatLegalDate,
  isLegalRevisionEffective,
  LEGAL_EFFECTIVE_DATE,
} from "@/lib/constants/legal";
import { ROUTES } from "@/lib/constants/routes";
import { getUser } from "@/lib/supabase/getUser";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect(ROUTES.LOGIN);

  if (!user.email_confirmed_at) {
    const query = new URLSearchParams({ purpose: "signup" });
    if (user.email) query.set("email", user.email);
    redirect(`${ROUTES.RESEND_EMAIL}?${query.toString()}`);
  }

  const agreementStatus = await getLegalAcceptanceStatus(user.id);
  if (!agreementStatus.canAccessService) {
    const pathname = (await headers()).get("x-pathname");
    redirect(getAgreementRequiredPath(validateRedirectPath(pathname)));
  }
  const showLegalRevisionNotice = !isLegalRevisionEffective();

  return (
    <div className="min-h-screen">
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      {showLegalRevisionNotice ? (
        <aside
          aria-label="법적 문서 개정 안내"
          className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950"
        >
          이용약관과 개인정보 처리방침이 {formatLegalDate(LEGAL_EFFECTIVE_DATE)}
          부터 개정됩니다. 시행 전에{" "}
          <Link className="underline" href={ROUTES.AGREEMENTS}>
            개정 내용을 확인하고 미리 동의하기
          </Link>
        </aside>
      ) : null}
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
    </div>
  );
}
