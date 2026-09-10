import { Suspense } from "react";

import { Footer } from "@/components/layout/Footer";
import { Header, HeaderSkeleton } from "@/components/layout/Header";

/**
 * 공개 콘텐츠(학습 가이드) 레이아웃.
 *
 * 로그인 없이 읽는 문서라 `(main)`의 인증 레이아웃이 아니라 `(legal)`처럼 헤더·푸터만 둔다.
 */
export default function ContentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      {children}
      <Footer />
    </div>
  );
}
