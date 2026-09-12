import { renderLandingMarkdown } from "@/features/landing/markdown";
import { SITE_URL } from "@/lib/constants/site";
import { markdownResponse } from "@/lib/seo/markdownResponse";

export const dynamic = "force-static";

function buildBody(): string {
  const body = renderLandingMarkdown();
  const footer = [
    "---",
    "",
    "## 관련 페이지",
    "",
    `- [개인정보 처리방침](${SITE_URL}/privacy.md)`,
    `- [이용약관](${SITE_URL}/terms.md)`,
    "",
  ].join("\n");
  return `${body}\n${footer}`;
}

// canonical은 랜딩 페이지가 스스로 선언한 값(app/page.tsx의 alternates.canonical)과
// 정확히 같아야 한다. SITE_URL은 trailing slash가 없는 형태로 정규화돼 있다.
export function GET(): Response {
  return markdownResponse(buildBody(), { canonicalUrl: SITE_URL });
}
