import type { Metadata } from "next";

import SignupPageClient from "./SignupPageClient";

export default function SignupPage() {
  return <SignupPageClient />;
}

// 검색 엔진 인덱싱 방지 (robots.txt Disallow보다 확실함 - 삭제 금지)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
