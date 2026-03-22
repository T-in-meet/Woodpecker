import "./globals.css";

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { QueryProvider } from "@/components/providers/QueryProvider";
import { SessionProvider } from "@/components/providers/SessionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://woodpecker-app.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "딱다구리 — 기록이 기억이 되는 간격 반복 학습 플랫폼",
    template: "%s | 딱다구리",
  },
  description:
    "기록한 순간부터 복습이 설계됩니다. 에빙하우스 망각곡선 기반 1-3-7일 간격 반복과 백지 테스트로 학습 내용을 장기 기억으로 전환하세요.",
  keywords: [
    "간격 반복 학습",
    "백지 테스트",
    "복습 알림",
    "망각곡선",
    "에빙하우스",
    "학습 도구",
    "기억력 향상",
    "인출 연습",
    "코딩테스트 복습",
  ],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: "딱다구리",
    title: "딱다구리 — 기록이 기억이 되는 간격 반복 학습 플랫폼",
    description:
      "에빙하우스 망각곡선 기반 1-3-7일 간격 반복과 백지 테스트로 학습 내용을 장기 기억으로 전환하세요.",
  },
  twitter: {
    card: "summary_large_image",
    title: "딱다구리 — 기록이 기억이 되는 간격 반복 학습 플랫폼",
    description:
      "에빙하우스 망각곡선 기반 1-3-7일 간격 반복과 백지 테스트로 학습 내용을 장기 기억으로 전환하세요.",
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
