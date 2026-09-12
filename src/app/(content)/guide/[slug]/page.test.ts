import { beforeEach, describe, expect, it, vi } from "vitest";

import { isPublishedGuide } from "@/features/guide/content";
import { SITE_URL } from "@/lib/constants/site";

import { generateMetadata, generateStaticParams } from "./page";

vi.mock("@/features/guide/content", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/guide/content")>();

  return { ...actual, isPublishedGuide: vi.fn(actual.isPublishedGuide) };
});

const mockedIsPublishedGuide = vi.mocked(isPublishedGuide);

describe("generateStaticParams", () => {
  it("등록된 모든 문서의 slug를 반환한다", () => {
    expect(generateStaticParams()).toEqual([
      { slug: "spaced-repetition" },
      { slug: "review-cycle" },
      { slug: "blank-test" },
    ]);
  });
});

describe("generateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("등록되지 않은 slug에는 메타데이터를 만들지 않는다", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "no-such-guide" }),
    });

    expect(metadata).toEqual({});
  });

  /* 본문이 없는 문서가 색인되면 얇은 콘텐츠로 평가받는다. 직접 URL로 열어보는 건
     막지 않되 색인만 뺀다. */
  it("미공개 문서는 noindex로 내보낸다", async () => {
    mockedIsPublishedGuide.mockReturnValue(false);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "blank-test" }),
    });

    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("공개 문서에는 robots 지시를 붙이지 않는다", async () => {
    mockedIsPublishedGuide.mockReturnValue(true);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "blank-test" }),
    });

    expect(metadata.robots).toBeUndefined();
  });

  it("self canonical과 문서 문구를 선언한다", async () => {
    mockedIsPublishedGuide.mockReturnValue(true);

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "blank-test" }),
    });

    expect(metadata.alternates?.canonical).toBe(`${SITE_URL}/guide/blank-test`);
    expect(metadata.title).toBe("백지 테스트란? 하는 방법부터 채점·복습까지");
    expect(metadata.openGraph?.title).toBe(
      "백지 테스트란? 하는 방법부터 채점·복습까지 | 딱다구리",
    );
  });
});
