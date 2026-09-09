/**
 * 학습 가이드 문서 목록.
 *
 * 페이지 메타데이터·`/guide` 인덱스·sitemap·breadcrumb·llms.txt가 모두 이 배열
 * 하나를 읽는다. 문서를 늘릴 때 손볼 곳이 여기뿐이어야 각 표면이 갈라지지 않는다.
 */

export type GuideDocument = {
  slug: string;
  /**
   * `<title>`에 들어가는 문구. 루트 레이아웃의 `title.template`이 브랜드를 붙이므로
   * 여기에는 접미사를 넣지 않는다.
   */
  title: string;
  /**
   * 페이지 안의 H1. 검색 결과에서 클릭을 받는 `title`과 역할이 달라 따로 둔다.
   * title은 검색어에 가깝게, heading은 페이지를 열고 읽기 시작하는 문장으로 쓴다.
   */
  heading: string;
  /** meta description. 랭킹 요소는 아니고 스니펫 생성 참고용이라 정확성을 우선한다. */
  description: string;
  /** `/guide` 인덱스 카드에 쓰는 한 줄. description보다 짧다. */
  summary: string;
  /**
   * 본문을 마지막으로 의미 있게 고친 날(KST, `YYYY-MM-DD`). 본문이 아직 없으면 `null`.
   *
   * 공개 여부를 이 필드 하나로 판정한다(`isPublishedGuide`). 별도의 `published`
   * 플래그를 두면 "날짜는 있는데 미공개" 같은 어긋난 조합이 생기고, sitemap의
   * lastModified에 쓸 정직한 값이 없는데도 공개되는 경로가 열린다.
   *
   * 본문을 채운 날짜를 여기 적는 순간 sitemap 등록·색인 허용·인덱스 노출이 함께 켜진다.
   */
  revisedOn: string | null;
};

export const GUIDE_DOCUMENTS = [
  {
    slug: "spaced-repetition",
    title: "간격 반복 학습이란? 복습 원리와 근거",
    heading: "간격 반복 학습이란 무엇인가",
    description:
      "배운 내용은 왜 잊히고, 왜 시간 간격을 두고 다시 봐야 할까요? 몰아서 공부하기와 나눠서 공부하기의 차이, 복습 간격을 정하는 기준, 그리고 복습할 때 다시 읽는 대신 무엇을 해야 하는지 정리했습니다.",
    summary: "왜 시간을 두고 다시 공부해야 하는지 알아봅니다.",
    revisedOn: "2026-09-09",
  },
  {
    slug: "review-cycle",
    title: "복습 주기 정하는 법 (1·3·7·14·30일)",
    heading: "복습 주기는 어떻게 정할까",
    description:
      "복습 간격은 왜 점점 늘려야 할까요? 1일·3일·7일·14일·30일 간격을 쓰는 이유, 하루에 여러 번 복습할 때의 처리, 밀린 복습을 따라잡는 방법을 딱다구리의 실제 설계로 설명합니다.",
    summary: "언제 다시 복습하는 것이 좋은지 알아봅니다.",
    revisedOn: "2026-09-09",
  },
  {
    slug: "blank-test",
    title: "백지 테스트하는 법 — 준비부터 채점까지",
    heading: "백지 테스트하는 법",
    description:
      "노트를 덮고 기억나는 내용을 적는 백지 테스트, 실제로 어떻게 할까요? 시작 전 준비, 아무것도 떠오르지 않을 때의 대처, 원본을 확인하는 시점, 표현이 달라도 기억했다고 볼 기준까지 정리했습니다.",
    summary: "배운 내용을 기억에서 꺼내 확인하는 방법을 알아봅니다.",
    revisedOn: "2026-09-09",
  },
] as const satisfies readonly GuideDocument[];

export type GuideSlug = (typeof GUIDE_DOCUMENTS)[number]["slug"];

export const GUIDE_INDEX_CONTENT = {
  title: "학습 가이드",
  heading: "효과적인 복습을 위한 학습 가이드",
  description:
    "간격 반복, 복습 주기, 백지 테스트 — 배운 내용을 오래 기억하기 위한 복습 방법을 세 편의 글로 정리했습니다.",
  /**
   * 화면에 그려지는 도입부. meta description(`description`)과 따로 둔다.
   *
   * 인덱스가 링크 목록만 남으면 얇은 페이지가 된다. 세 문서를 왜 이 순서로 읽는지를
   * 먼저 설명해, 목록에 들어가기 전에 읽을 것이 있게 한다.
   */
  intro: [
    "효과적인 복습은 단순히 여러 번 보는 것만으로 이루어지지 않습니다.",
    "먼저 왜 시간을 두고 다시 공부해야 하는지 이해하고, 그다음 언제 다시 볼지 정한 뒤, 복습할 때는 기억에서 직접 내용을 꺼내 확인하는 과정이 필요합니다.",
    "이 가이드에서는 이 세 단계를 간격 반복 → 복습 주기 → 백지 테스트 순서로 설명합니다.",
  ],
  /** breadcrumb에 쓰는 이름. URL 세그먼트(`guide`)가 아니라 사용자가 읽는 경로명이다. */
  breadcrumbLabel: "학습 가이드",
} as const;

/** 본문이 채워진 문서인지. 미공개 문서는 sitemap·인덱스·내부 링크에서 모두 빠진다. */
export function isPublishedGuide(document: GuideDocument): boolean {
  return document.revisedOn !== null;
}

export function findGuideDocument(slug: string): GuideDocument | undefined {
  return GUIDE_DOCUMENTS.find((document) => document.slug === slug);
}

export function getPublishedGuideDocuments(): readonly GuideDocument[] {
  return GUIDE_DOCUMENTS.filter(isPublishedGuide);
}

/**
 * slug로 공개 여부를 판정한다.
 *
 * `GuideInlineLink`가 미공개 문서에 아무것도 렌더하지 않으므로 링크 자체는 안전하지만,
 * 호출부가 링크를 감싸는 여백·구분선까지 지우려면 판정이 밖에서도 필요하다.
 */
export function isGuidePublished(slug: string): boolean {
  const document = findGuideDocument(slug);

  return document !== undefined && isPublishedGuide(document);
}
