import Image from "next/image";
import type { ReactNode } from "react";

import { GUIDE_INDEX_CONTENT } from "../content";
import { GuideBreadcrumb, type GuideBreadcrumbEntry } from "./GuideBreadcrumb";

/**
 * 가이드 목록·문서 상단의 히어로 밴드.
 *
 * `app/(legal)/LegalPage.tsx`의 히어로와 같은 마크업이다. 이용약관·개인정보
 * 처리방침과 나란히 놓였을 때 같은 서비스의 공개 문서로 읽히도록 배경·로고·
 * kicker·명조 제목 구성을 그대로 따른다. 가이드에만 필요한 breadcrumb은 밴드
 * 안 맨 위에 두고, 제목 아래 한 줄(`children`)은 법적 페이지의 "시행일" 자리다.
 */
export function GuideHero({
  breadcrumb,
  title,
  children,
}: {
  breadcrumb: readonly GuideBreadcrumbEntry[];
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-b border-stone-200/60">
      <div className="absolute inset-0 bg-linear-to-br from-amber-50 via-orange-50 to-rose-50" />
      <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-linear-to-br from-amber-200/40 to-orange-200/40 blur-3xl" />
      <div className="absolute -bottom-20 -left-40 h-80 w-80 rounded-full bg-linear-to-tr from-rose-200/40 to-pink-200/40 blur-3xl" />

      <div className="relative mx-auto max-w-3xl px-6 py-16 text-center text-prose-ko">
        <div className="mb-8 flex justify-center">
          <GuideBreadcrumb entries={breadcrumb} />
        </div>
        <div className="mb-6 flex justify-center">
          <Image src="/woodpecker.png" alt="딱다구리" width={80} height={80} />
        </div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700/70">
          {GUIDE_INDEX_CONTENT.breadcrumbLabel}
        </p>
        <h1 className="font-[family-name:var(--font-noto-serif-kr)] text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
          {title}
        </h1>
        {children && (
          <div className="mt-4 text-sm text-stone-500">{children}</div>
        )}
      </div>
    </div>
  );
}
