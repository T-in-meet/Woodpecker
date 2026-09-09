import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GuideArticle } from "@/features/guide/components/GuideArticle";
import { GuideBreadcrumb } from "@/features/guide/components/GuideBreadcrumb";
import {
  findGuideDocument,
  GUIDE_DOCUMENTS,
  GUIDE_INDEX_CONTENT,
  isPublishedGuide,
} from "@/features/guide/content";
import { readGuideMarkdown } from "@/features/guide/lib/readGuideMarkdown";
import { getGuideRoute, ROUTES } from "@/lib/constants/routes";
import { SITE_NAME, SITE_URL } from "@/lib/constants/site";
import { buildBreadcrumbJsonLd } from "@/lib/seo/breadcrumbJsonLd";
import { buildSocialMetadata } from "@/lib/seo/socialMetadata";

type GuidePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return GUIDE_DOCUMENTS.map((document) => ({ slug: document.slug }));
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const document = findGuideDocument(slug);

  if (!document) {
    return {};
  }

  const pageUrl = `${SITE_URL}${getGuideRoute(document.slug)}`;

  return {
    title: document.title,
    description: document.description,
    alternates: {
      canonical: pageUrl,
    },
    /* 본문이 아직 없는 문서는 색인에서 뺀다. 직접 URL로 열어 미리 볼 수는 있게 두되,
       빈 페이지가 색인돼 얇은 콘텐츠로 평가받는 경로는 막는다. */
    ...(isPublishedGuide(document)
      ? {}
      : { robots: { index: false, follow: false } }),
    ...buildSocialMetadata({
      title: `${document.title} | ${SITE_NAME}`,
      description: document.description,
      url: pageUrl,
    }),
  };
}

export default async function GuideDocumentPage({ params }: GuidePageProps) {
  const { slug } = await params;
  const document = findGuideDocument(slug);

  if (!document) {
    notFound();
  }

  const markdown = await readGuideMarkdown(document.slug);
  const pageUrl = `${SITE_URL}${getGuideRoute(document.slug)}`;
  const jsonLdString = JSON.stringify(
    buildBreadcrumbJsonLd([
      { name: "홈", url: SITE_URL },
      {
        name: GUIDE_INDEX_CONTENT.breadcrumbLabel,
        url: `${SITE_URL}${ROUTES.GUIDE}`,
      },
      { name: document.heading, url: pageUrl },
    ]),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString }}
      />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <GuideBreadcrumb
          entries={[
            { name: "홈", href: ROUTES.HOME },
            {
              name: GUIDE_INDEX_CONTENT.breadcrumbLabel,
              href: ROUTES.GUIDE,
            },
            { name: document.heading },
          ]}
        />

        <div className="mt-6">
          <GuideArticle heading={document.heading} markdown={markdown} />
        </div>
      </main>
    </>
  );
}
