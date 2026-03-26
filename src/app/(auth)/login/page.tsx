import type { Metadata } from "next";

// 검색 엔진 인덱싱 방지 (robots.txt Disallow보다 확실함 — 삭제 금지)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <div>로그인</div>;
}
