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
    default: "딱다구리 — 기록이 기억이 되는 간격 반복 학습 공간",
    template: "%s | 딱다구리",
  },
  description:
    "기록한 순간부터 복습이 설계됩니다. 인지 과학의 간격 반복 학습을 기반으로 한 1-3-7일 복습 알림과 백지 테스트 등 인출 연습으로 코딩테스트·기술 면접 학습 내용을 장기 기억으로 전환하세요.",
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
      "인지 과학의 간격 반복 학습을 기반으로 한 1-3-7일 복습 알림과 백지 테스트 등 인출 연습으로 학습 내용을 장기 기억으로 전환하세요..",
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
