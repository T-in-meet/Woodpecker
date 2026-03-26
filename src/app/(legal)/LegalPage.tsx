import Image from "next/image";
import Link from "next/link";

export type LegalSection = {
  article: string;
  title: string;
  content: React.ReactNode;
};

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

const serifStyle = { fontFamily: "var(--font-noto-serif-kr), serif" };

export function LegalPage({
  title,
  effectiveDate,
  intro,
  sections,
  crossLink,
  footerNote,
}: LegalPageProps) {
  return (
    <main className="min-h-screen" style={{ backgroundColor: "#faf8f3" }}>
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
          <h1
            className="text-4xl font-bold tracking-tight text-stone-900"
            style={serifStyle}
          >
            {title}
          </h1>
          <p className="mt-4 text-sm text-stone-500">시행일: {effectiveDate}</p>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-3xl px-6 py-14">
        {/* Intro */}
        <div className="mb-12 rounded-r-lg border-l-4 border-amber-400 bg-amber-50/60 px-6 py-5">
          <p className="text-sm leading-relaxed text-stone-600">{intro}</p>
        </div>

        {/* Sections */}
        <div className="divide-y divide-stone-200">
          {sections.map((section) => (
            <section key={section.article} className="py-8">
              {/* Article header */}
              <div className="mb-4">
                <p
                  className="text-sm font-semibold text-amber-600"
                  style={serifStyle}
                >
                  {section.article}
                </p>
                <h2
                  className="text-xl font-semibold text-stone-900"
                  style={serifStyle}
                >
                  {section.title}
                </h2>
              </div>

              {/* Content */}
              <div className="prose prose-stone prose-sm max-w-none [&_li]:leading-relaxed [&_li]:text-stone-600 [&_li_ul]:mb-0 [&_li_ul]:mt-1.5 [&_ol]:mt-2 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p]:leading-relaxed [&_p]:text-stone-600 [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
                {section.content}
              </div>
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
      </div>
    </main>
  );
}
