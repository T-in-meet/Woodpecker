import type { Metadata } from "next";

import SignupPageClient from "@/features/auth/signup/components/SignupPageClient";
// 검색 엔진 인덱싱 방지 (robots.txt Disallow보다 확실함 - 삭제 금지)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return <SignupPageClient />;
}
