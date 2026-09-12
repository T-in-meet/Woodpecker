import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Footer } from "@/components/layout/Footer";
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

/* (main) 하위는 전부 로그인 사용자 전용 화면이라 검색 대상이 아니다.
   metadata를 두지 않으면 루트 레이아웃의 robots(index: true)를 그대로 상속해
   "색인해도 된다"고 선언하게 된다. 실제로 /notes/today가 그 상태였다.
   개별 페이지 선언에 기대지 않고 여기서 한 번 막아 누락이 생기지 않게 한다.
   페이지가 자기 metadata로 덮어쓸 수 있으므로 기존 선언은 그대로 유효하다. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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
  const showLegalRevisionNotice =
    !agreementStatus.isComplete && !isLegalRevisionEffective();

  return (
    /* main의 flex-1이 동작하려면 부모가 flex 컨테이너여야 한다. 그래야 내용이
       짧은 페이지에서도 푸터가 화면 중간에 뜨지 않고 하단에 붙는다. */
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      {showLegalRevisionNotice ? (
        <aside
          aria-label="법적 문서 개정 안내"
          className="border-b border-amber-200 bg-amber-50 text-sm text-amber-950"
        >
          {/* 모바일은 Header 컨테이너 패딩에 맞춰 왼쪽 정렬, md 이상은 가운데 정렬 */}
          <p className="mx-auto max-w-5xl px-6 py-2 text-left md:text-center">
            이용약관과 개인정보 처리방침이{" "}
            {formatLegalDate(LEGAL_EFFECTIVE_DATE)}부터 개정됩니다. 시행 전에{" "}
            <Link className="underline" href={ROUTES.AGREEMENTS}>
              개정 내용을 확인하고 미리 동의하기
            </Link>
          </p>
        </aside>
      ) : null}
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      {/* 모바일에서는 화면을 아끼고, 약관·개인정보처리방침 경로는 MobileMenu가 맡는다. */}
      <div className="hidden md:block">
        <Footer />
      </div>
    </div>
  );
}
