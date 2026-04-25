import type { Metadata } from "next";
import { Suspense } from "react";

import { LoginForm } from "@/features/auth/login/components/LoginForm";

// 검색 엔진 인덱싱 방지 (robots.txt Disallow보다 확실함 — 삭제 금지)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <div className="md:flex md:min-h-[calc(100dvh-4.5rem)] md:items-center md:justify-center">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
