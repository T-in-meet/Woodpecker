import Image from "next/image";

import {
  LegalContent,
  type LegalSection,
} from "@/components/legal/LegalContent";

export type { LegalSection };

type LegalPageProps = {
  title: string;
  effectiveDate: string;
  intro: string;
  sections: LegalSection[];
  crossLink: {
    href: string;
    label: string;
  };
  footerNote: string;
};

export function LegalPage({
  title,
  effectiveDate,
  intro,
  sections,
  crossLink,
  footerNote,
}: LegalPageProps) {
  return (
    <main className="min-h-screen bg-[#faf8f3]">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-stone-200/60">
        <div className="absolute inset-0 bg-linear-to-br from-amber-50 via-orange-50 to-rose-50" />
        <div className="absolute -right-40 -top-40 h-96 w-96 rounded-full bg-linear-to-br from-amber-200/40 to-orange-200/40 blur-3xl" />
        <div className="absolute -bottom-20 -left-40 h-80 w-80 rounded-full bg-linear-to-tr from-rose-200/40 to-pink-200/40 blur-3xl" />

        <div className="relative mx-auto max-w-3xl px-6 py-20 text-center">
          <div className="mb-6 flex justify-center">
            <Image src="/favicon.svg" alt="딱다구리" width={44} height={44} />
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700/70">
            법적 고지
          </p>
          <h1 className="font-[family-name:var(--font-noto-serif-kr)] text-4xl font-bold tracking-tight text-stone-900">
            {title}
          </h1>
          <p className="mt-4 text-sm text-stone-500">시행일: {effectiveDate}</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-6 py-14">
        <LegalContent
          intro={intro}
          sections={sections}
          crossLink={crossLink}
          footerNote={footerNote}
        />
      </div>
    </main>
  );
}
