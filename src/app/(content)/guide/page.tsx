import type { Metadata } from "next";
import Link from "next/link";

import { GuideBreadcrumb } from "@/features/guide/components/GuideBreadcrumb";
import {
  getPublishedGuideDocuments,
  GUIDE_DOCUMENTS,
  GUIDE_INDEX_CONTENT,
  isPublishedGuide,
} from "@/features/guide/content";
import { getGuideRoute, ROUTES } from "@/lib/constants/routes";
import { SITE_NAME, SITE_URL } from "@/lib/constants/site";
import { buildBreadcrumbJsonLd } from "@/lib/seo/breadcrumbJsonLd";
import { buildSocialMetadata } from "@/lib/seo/socialMetadata";

const pageUrl = `${SITE_URL}${ROUTES.GUIDE}`;

/**
 * 공개된 문서가 하나도 없으면 색인에서 뺀다.
 *
 * 링크만 있고 읽을 글이 없는 목록을 색인시키면 얇은 페이지로 평가받는다. 첫 문서의
 * `revisedOn`이 채워지는 순간 함께 열린다.
 */
const hasPublishedGuide = getPublishedGuideDocuments().length > 0;

export const metadata: Metadata = {
  title: GUIDE_INDEX_CONTENT.title,
  description: GUIDE_INDEX_CONTENT.description,
  alternates: {
    canonical: pageUrl,
  },
  ...(hasPublishedGuide ? {} : { robots: { index: false, follow: false } }),
  ...buildSocialMetadata({
    title: `${GUIDE_INDEX_CONTENT.title} | ${SITE_NAME}`,
    description: GUIDE_INDEX_CONTENT.description,
    url: pageUrl,
  }),
};

const jsonLdString = JSON.stringify(
  buildBreadcrumbJsonLd([
    { name: "홈", url: SITE_URL },
    { name: GUIDE_INDEX_CONTENT.breadcrumbLabel, url: pageUrl },
  ]),
);

export default function GuideIndexPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString }}
      />
      <main className="mx-auto max-w-3xl px-6 py-14 text-prose-ko">
        <GuideBreadcrumb
          entries={[
            { name: "홈", href: ROUTES.HOME },
            { name: GUIDE_INDEX_CONTENT.breadcrumbLabel },
          ]}
        />

        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
          {GUIDE_INDEX_CONTENT.heading}
        </h1>
        <div className="mt-6 space-y-4 text-muted-foreground">
          {GUIDE_INDEX_CONTENT.intro.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <ul className="mt-10 space-y-4">
          {GUIDE_DOCUMENTS.map((document) => (
            <li key={document.slug}>
              {isPublishedGuide(document) ? (
                <Link
                  href={getGuideRoute(document.slug)}
                  className="block cursor-pointer rounded-lg border p-5 transition-colors hover:bg-muted/50"
                >
                  <h2 className="font-semibold">{document.heading}</h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {document.summary}
                  </p>
                </Link>
              ) : (
                /* 미공개 문서도 목록에는 남긴다. 어떤 글이 준비 중인지는 알리되,
                   링크를 걸지 않아 빈 페이지로 들어가는 경로는 만들지 않는다. */
                <div className="rounded-lg border border-dashed p-5">
                  <h2 className="font-semibold text-muted-foreground">
                    {document.heading}
                  </h2>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    {document.summary}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">준비 중</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
