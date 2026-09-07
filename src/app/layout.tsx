// layout.tsx (Root Layout)
// 앱 전체에 공통 적용되는 최상위 레이아웃.
// 모든 페이지는 이 파일의 RootLayout을 통해 렌더링됨.
import "./globals.css";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";

import { DevelopmentServiceWorkerCleanup } from "@/components/providers/DevelopmentServiceWorkerCleanup";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ToasterProvider } from "@/components/providers/ToasterProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { landingDescription } from "@/features/landing/content";
import { SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/constants/site";
import { buildSocialMetadata } from "@/lib/seo/socialMetadata";

/* ─── 폰트 ───────────────────────────────────────────────────────────────────
   Geist (본문), Geist_Mono (코드) 폰트를 CSS 변수로 등록.
   body의 className에서 변수명으로 참조해 전역 적용함.
─────────────────────────────────────────────────────────────────────────── */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* ─── SEO 메타데이터 ──────────────────────────────────────────────────────────
   Next.js가 <head>에 자동으로 삽입하는 메타 정보.
   - title.template: 하위 페이지에서 title을 지정하면 "%s | 딱다구리" 형식으로 조합됨
   - openGraph: 카카오톡, 슬랙 등 링크 공유 시 미리보기에 사용
   - twitter: 트위터(X) 링크 공유 시 카드 형태로 표시
   - robots: 검색엔진에 색인(index)·링크 추적(follow) 허용 여부를 코드 레벨에서도 지정

   canonical은 여기 두지 않는다. 루트에 두면 하위 페이지가 이를 상속해서,
   자기 canonical을 선언하지 않은 페이지가 전부 홈을 대표 URL로 가리키게 된다.
   대부분이 noindex라 당장 피해는 없지만 "색인하지 말라 + 대표 URL은 다른 페이지"는
   서로 어긋나는 신호다. 색인 대상 페이지(/, /terms, /privacy)가 각자
   alternates.canonical을 선언하고 있으므로 그쪽을 정본으로 둔다.
─────────────────────────────────────────────────────────────────────────── */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: landingDescription,
  icons: {
    icon: "/favicon.svg",
  },
  ...buildSocialMetadata({
    title: SITE_TITLE,
    description: landingDescription,
    url: SITE_URL,
  }),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

/* ─── 루트 레이아웃 ──────────────────────────────────────────────────────────
   모든 페이지를 감싸는 HTML 뼈대.
   - SessionProvider: Supabase 인증 세션을 전역에서 접근 가능하게 관리
   - QueryProvider: TanStack Query 클라이언트를 제공해 서버 상태 캐싱·동기화 처리
─────────────────────────────────────────────────────────────────────────── */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 미들웨어가 요청마다 생성한 nonce를 읽어 layout을 동적 렌더링으로 강제한다.
  // 이렇게 해야 CSP 헤더의 nonce와 Script 컴포넌트 nonce가 항상 일치한다.
  // <Script nonce={_nonce} /> 형태로 외부 스크립트 추가 시 이 값을 사용한다.
  const _nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <DevelopmentServiceWorkerCleanup />
        <SessionProvider>
          <QueryProvider>
            <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          </QueryProvider>
          <ToasterProvider />
        </SessionProvider>
      </body>
    </html>
  );
}
