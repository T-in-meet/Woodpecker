// layout.tsx (Root Layout)
// 앱 전체에 공통 적용되는 최상위 레이아웃.
// 모든 페이지는 이 파일의 RootLayout을 통해 렌더링됨.

import "./globals.css";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { QueryProvider } from "@/components/providers/QueryProvider";
import { SessionProvider } from "@/components/providers/SessionProvider";

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

const SITE_URL = "https://woodpecker-app.vercel.app";

/* ─── SEO 메타데이터 ──────────────────────────────────────────────────────────
   Next.js가 <head>에 자동으로 삽입하는 메타 정보.
   - title.template: 하위 페이지에서 title을 지정하면 "%s | 딱다구리" 형식으로 조합됨
   - openGraph: 카카오톡, 슬랙 등 링크 공유 시 미리보기에 사용
   - twitter: 트위터(X) 링크 공유 시 카드 형태로 표시
   - alternates.canonical: 검색엔진에 대표 URL을 명시해 중복 색인 방지
   - robots: 검색엔진에 색인(index)·링크 추적(follow) 허용 여부를 코드 레벨에서도 지정
─────────────────────────────────────────────────────────────────────────── */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "딱다구리 — 기록이 기억이 되는 간격 반복 학습 공간",
    template: "%s | 딱다구리",
  },
  description:
    "기록한 순간부터 복습이 설계됩니다. 인지 과학의 간격 반복 학습을 기반으로 한 1-3-7일 복습 알림과 백지 테스트 등 인출 연습으로 학습 내용을 장기 기억으로 전환하세요.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: "딱다구리",
    title: "딱다구리 — 기록이 기억이 되는 간격 반복 학습 공간",
    description:
      "인지 과학의 간격 반복 학습을 기반으로 한 1-3-7일 복습 알림과 백지 테스트 등 인출 연습으로 학습 내용을 장기 기억으로 전환하세요.",
  },
  twitter: {
    card: "summary_large_image",
    title: "딱다구리 — 기록이 기억이 되는 간격 반복 학습 공간",
    description:
      "인지 과학의 간격 반복 학습을 기반으로 한 1-3-7일 복습 알림과 백지 테스트 등 인출 연습으로 학습 내용을 장기 기억으로 전환하세요.",
  },
  alternates: {
    canonical: SITE_URL,
  },
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
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          <QueryProvider>{children}</QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
