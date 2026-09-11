import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GuideDocumentPage from "@/app/(content)/guide/[slug]/page";
import sitemap from "@/app/sitemap";
import { SITE_URL } from "@/lib/constants/site";

import { GuideArticle, GuideArticleMeta } from "../components/GuideArticle";
import { GUIDE_AUTHOR, GUIDE_DOCUMENTS, isPublishedGuide } from "../content";
import { prepareGuideMarkdown } from "../lib/prepareGuideMarkdown";

vi.mock("@/features/guide/content", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../content")>();
  return { ...actual, isPublishedGuide: vi.fn(actual.isPublishedGuide) };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isPublishedGuide).mockImplementation(
    (document) => document.revisedOn !== null,
  );
});
afterEach(cleanup);

describe("가이드 본문의 H2 앵커", () => {
  it("인라인 마크다운이 섞인 제목에도 id를 달고 앵커 표기는 숨긴다", () => {
    const { markdown, headings } = prepareGuideMarkdown(
      "## `review_round`는 **무엇**인가\n\n본문\n",
    );
    render(<GuideArticle markdown={markdown} headings={headings} />);

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveAttribute("id", "section-1");
    expect(heading).toHaveTextContent("review_round는 무엇인가");
    expect(heading).not.toHaveTextContent("{#");
    expect(heading.querySelector("code")).toHaveTextContent("review_round");
    expect(heading.querySelector("strong")).toHaveTextContent("무엇");
  });

  it("앵커가 없는 제목은 그대로 그린다", () => {
    render(<GuideArticle markdown="## 평범한 절" headings={[]} />);

    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).not.toHaveAttribute("id");
    expect(heading).toHaveTextContent("평범한 절");
  });
});

describe("가이드 작성자와 날짜", () => {
  it("작성자 소개 링크와 수정일을 표시한다", () => {
    const { container } = render(
      <GuideArticleMeta author={GUIDE_AUTHOR} revisedOn="2026-09-10" />,
    );
    expect(
      screen.getByRole("link", { name: GUIDE_AUTHOR.name }),
    ).toHaveAttribute("href", "/guide#about");
    expect(container.querySelector("time")).toHaveAttribute(
      "datetime",
      "2026-09-10",
    );
    expect(screen.getByText("2026.09.10")).toBeInTheDocument();
  });

  it("미공개 문서에는 날짜를 표시하지 않는다", () => {
    const { container } = render(
      <GuideArticleMeta author={GUIDE_AUTHOR} revisedOn={null} />,
    );
    expect(container.querySelector("time")).toBeNull();
    expect(screen.queryByText(/최종 수정/)).not.toBeInTheDocument();
  });

  it.each(GUIDE_DOCUMENTS)(
    "$slug의 화면·Article·사이트맵 날짜와 URL이 일치한다",
    async (document) => {
      const { container } = render(
        await GuideDocumentPage({
          params: Promise.resolve({ slug: document.slug }),
        }),
      );
      const scripts = Array.from(
        container.querySelectorAll('script[type="application/ld+json"]'),
      );
      const structuredData: unknown[] = scripts.map((script) =>
        JSON.parse(script.textContent ?? "null"),
      );
      const url = `${SITE_URL}/guide/${document.slug}`;
      expect(structuredData).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            "@type": "BreadcrumbList",
            itemListElement: expect.arrayContaining([
              expect.objectContaining({ name: document.heading, item: url }),
            ]),
          }),
          expect.objectContaining({
            "@type": "Article",
            headline: document.heading,
            description: document.description,
            dateModified: document.revisedOn,
            mainEntityOfPage: url,
            author: {
              "@type": "Organization",
              name: GUIDE_AUTHOR.name,
              url: `${SITE_URL}${GUIDE_AUTHOR.href}`,
            },
          }),
        ]),
      );
      expect(scripts[1]?.textContent).not.toMatch(/datePublished|"image"/);
      expect(container.querySelector("time")).toHaveAttribute(
        "datetime",
        document.revisedOn,
      );
      expect(
        sitemap().find((entry) => entry.url === url)?.lastModified,
      ).toEqual(new Date(`${document.revisedOn}T00:00:00+09:00`));
    },
  );

  it("미공개 페이지는 BreadcrumbList만 출력한다", async () => {
    vi.mocked(isPublishedGuide).mockReturnValue(false);
    const { container } = render(
      await GuideDocumentPage({
        params: Promise.resolve({ slug: "blank-test" }),
      }),
    );
    const scripts = container.querySelectorAll(
      'script[type="application/ld+json"]',
    );
    expect(scripts).toHaveLength(1);
    expect(scripts[0]?.textContent).toContain('"@type":"BreadcrumbList"');
  });
});
