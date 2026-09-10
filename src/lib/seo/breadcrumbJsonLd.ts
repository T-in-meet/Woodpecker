/**
 * BreadcrumbList 구조화 데이터.
 *
 * URL 구조를 그대로 복제하는 게 목적이 아니라 사용자가 사이트 계층을 이해하는
 * 일반적인 경로를 표현하는 것이 목적이다. 그래서 세그먼트 이름(`guide`)이 아니라
 * 화면에 보이는 이름("학습 가이드")을 넣는다.
 *
 * 마지막 항목(현재 페이지)까지 포함하고 item으로 자기 URL을 가리킨다.
 */
type BreadcrumbEntry = {
  name: string;
  url: string;
};

export function buildBreadcrumbJsonLd(entries: readonly BreadcrumbEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: entry.name,
      item: entry.url,
    })),
  };
}
