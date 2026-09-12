// 마크다운/텍스트 라우트(/index.md, /terms.md, /privacy.md, /llms.txt, /llms-full.txt)의 공통 응답.

/**
 * 이 라우트들은 robots.txt에서 크롤이 허용돼 있고(disallow는 /api/뿐),
 * middleware matcher에서도 제외돼 있어 미들웨어가 붙이는 Link 헤더조차 닿지 않는다.
 * 아무 신호도 주지 않으면 HTML 페이지와 내용이 같은 URL이 따로 색인돼 대표 URL이
 * 모호해진다. 마크다운에는 <link rel="canonical">을 넣을 자리가 없으므로 HTTP 헤더로
 * 대표 URL을 알린다. 구글은 비 HTML 문서에 대해 Link: rel="canonical"을 지원한다.
 *
 * canonicalUrl을 넘기지 않는 문서(llms.txt·llms-full.txt)는 대응하는 HTML URL이 없다.
 * 없는 URL을 대표로 가리키는 대신 X-Robots-Tag로 검색 색인에서만 빼고, robots.txt의
 * 크롤 허용은 그대로 둬서 LLM 크롤러의 수집 경로는 남긴다.
 */
type MarkdownResponseOptions = {
  canonicalUrl?: string;
};

const CACHE_CONTROL = "public, max-age=3600, s-maxage=86400";

export function markdownResponse(
  body: string,
  { canonicalUrl }: MarkdownResponseOptions = {},
): Response {
  const headers = new Headers({
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": CACHE_CONTROL,
  });

  if (canonicalUrl) {
    headers.set("Link", `<${canonicalUrl}>; rel="canonical"`);
  } else {
    headers.set("X-Robots-Tag", "noindex");
  }

  return new Response(body, { status: 200, headers });
}
