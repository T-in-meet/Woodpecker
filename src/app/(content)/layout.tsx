import { Noto_Serif_KR } from "next/font/google";
import { Suspense } from "react";

import { Footer } from "@/components/layout/Footer";
import { Header, HeaderSkeleton } from "@/components/layout/Header";

/* 히어로 제목 서체. `(legal)/layout.tsx`와 같은 선언이다. next/font는 호출한
   레이아웃에만 CSS 변수를 심으므로 라우트 그룹마다 따로 부른다. */
const notoSerifKR = Noto_Serif_KR({
  weight: ["400", "600", "700"],
  subsets: ["latin"],
  variable: "--font-noto-serif-kr",
  display: "swap",
  preload: false,
});

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
    <div className={`min-h-screen ${notoSerifKR.variable}`}>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      {/* 법적 페이지(`LegalPage`)와 같은 크림색 본문 배경 */}
      <div className="min-h-screen bg-[#faf8f3]">{children}</div>
      <Footer />
    </div>
  );
}
