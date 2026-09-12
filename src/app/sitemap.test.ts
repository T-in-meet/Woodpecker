import { beforeEach, describe, expect, it, vi } from "vitest";

import { getPublishedGuideDocuments } from "@/features/guide/content";
import { SITE_URL } from "@/lib/constants/site";

import sitemap from "./sitemap";

vi.mock("@/features/guide/content", () => ({
  getPublishedGuideDocuments: vi.fn(),
}));

const mockedGetPublishedGuideDocuments = vi.mocked(getPublishedGuideDocuments);

function urlsOf() {
  return sitemap().map((entry) => entry.url);
}

describe("sitemap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetPublishedGuideDocuments.mockReturnValue([]);
  });

  it("공개된 가이드가 없으면 /guide와 가이드 문서를 싣지 않는다", () => {
    expect(urlsOf()).toEqual([
      SITE_URL,
      `${SITE_URL}/terms`,
      `${SITE_URL}/privacy`,
    ]);
  });

  it("공개된 가이드가 있으면 인덱스와 문서를 함께 싣는다", () => {
    mockedGetPublishedGuideDocuments.mockReturnValue([
      {
        slug: "blank-test",
        title: "백지 테스트하는 법",
        heading: "백지 테스트하는 법",
        description: "설명",
        summary: "요약",
        revisedOn: "2026-09-09",
      },
    ]);

    expect(urlsOf()).toContain(`${SITE_URL}/guide`);
    expect(urlsOf()).toContain(`${SITE_URL}/guide/blank-test`);
  });

  /* lastModified는 배포 시각이 아니라 본문 개정일이어야 한다. 구글은 부정확한
     lastmod를 학습하면 그 사이트의 lastmod를 통째로 무시한다. */
  it("가이드 lastModified로 revisedOn을 KST 자정으로 해석한다", () => {
    mockedGetPublishedGuideDocuments.mockReturnValue([
      {
        slug: "blank-test",
        title: "백지 테스트하는 법",
        heading: "백지 테스트하는 법",
        description: "설명",
        summary: "요약",
        revisedOn: "2026-09-09",
      },
    ]);

    const guideEntry = sitemap().find(
      (entry) => entry.url === `${SITE_URL}/guide/blank-test`,
    );

    expect(guideEntry?.lastModified).toEqual(
      new Date("2026-09-09T00:00:00+09:00"),
    );
  });
});
