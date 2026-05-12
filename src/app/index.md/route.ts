import { renderLandingMarkdown } from "@/features/landing/markdown";
import { SITE_URL } from "@/lib/constants/site";

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

export function GET(): Response {
  return new Response(buildBody(), {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
