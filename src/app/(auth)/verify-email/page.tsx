import type { Metadata } from "next";

import VerifyEmailPageClient from "@/features/auth/verify-email/components/VerifyEmailPageClient";

// 검색 엔진 인덱싱 방지 (robots.txt Disallow보다 확실함 - 삭제 금지)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ email?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: Props) {
  const { email } = await searchParams;

  return <VerifyEmailPageClient email={email} />;
}
