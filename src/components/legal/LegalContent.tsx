/**
 * LegalContent — 법적 문서(이용약관 · 개인정보 처리방침)의 콘텐츠 레이어
 *
 * 이 컴포넌트는 UI 렌더링만 담당하며, 실제 약관 텍스트 데이터는 포함하지 않음.
 * 데이터(sections 배열)는 호출하는 쪽에서 주입해야 함.
 *
 * 현재 사용처:
 *   - app/(legal)/LegalPage.tsx  →  /terms, /privacy 풀페이지 렌더링
 *
 * 모달 · 드로어 · 인라인 등 다른 방식으로 렌더링할 때도 이 컴포넌트를 그대로 사용할 것.
 * Hero 영역(제목·시행일·배경 그라디언트)이 필요하면 LegalPage를 쓰고,
 * 콘텐츠만 필요하면 이 컴포넌트를 직접 사용할 것.
 *
 * 약관 데이터를 여러 곳에서 공유해야 한다면 별도 데이터 파일로 분리 권장:
 *   features/legal/terms.data.ts
 *   features/legal/privacy.data.ts
 */

import Link from "next/link";

const LEGAL_PROSE_CN =
  "prose prose-stone prose-sm max-w-none [&_li]:leading-relaxed [&_li]:text-stone-600 [&_li_ul]:mb-0 [&_li_ul]:mt-1.5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p]:leading-relaxed [&_p]:text-stone-600 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5";

export type LegalSection = {
  article: string;
  title: string;
  content: React.ReactNode;
};

type LegalContentProps = {
  intro: string;
  sections: LegalSection[];
  crossLink: {
    href: string;
    label: string;
  };
  footerNote: string;
};

export function LegalContent({
  intro,
  sections,
  crossLink,
  footerNote,
}: LegalContentProps) {
  return (
    <>
      {/* Intro */}
      <div className="mb-12 rounded-r-lg border-l-4 border-amber-400 bg-amber-50/60 px-6 py-5">
        <p className="text-sm leading-relaxed text-stone-600">{intro}</p>
      </div>

      {/* Sections */}
      <div className="divide-y divide-stone-200">
        {sections.map((section) => (
          <section key={section.article} className="py-8">
            <div className="mb-4">
              <p className="font-[family-name:var(--font-noto-serif-kr)] text-sm font-semibold text-amber-600">
                {section.article}
              </p>
              <h2 className="font-[family-name:var(--font-noto-serif-kr)] text-xl font-semibold text-stone-900">
                {section.title}
              </h2>
            </div>
            <div className={LEGAL_PROSE_CN}>{section.content}</div>
          </section>
        ))}
      </div>

      {/* Divider */}
      <div className="my-12 flex items-center gap-4">
        <div className="h-px flex-1 bg-stone-200" />
        <span className="text-xs text-stone-300">✦</span>
        <div className="h-px flex-1 bg-stone-200" />
      </div>

      {/* Cross-link */}
      <Link
        href={crossLink.href}
        className="group flex items-center justify-between rounded-xl border border-stone-200 bg-white/70 px-6 py-5 transition-all duration-200 hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-sm"
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">
            관련 문서
          </p>
          <p className="mt-1 text-base font-semibold text-stone-800">
            {crossLink.label}
          </p>
        </div>
        <span className="text-stone-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-amber-500">
          →
        </span>
      </Link>

      {/* Footer note */}
      <p className="mt-10 text-center text-xs text-stone-400">{footerNote}</p>
    </>
  );
}
