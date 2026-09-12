import { getPublishedGuideDocuments } from "@/features/guide/content";
import {
  landingDescription,
  learningFlowContent,
  learningToolsContent,
} from "@/features/landing/content";
import { getGuideRoute } from "@/lib/constants/routes";
import { SITE_URL } from "@/lib/constants/site";
import { markdownResponse } from "@/lib/seo/markdownResponse";

export const dynamic = "force-static";

// index.md 요약은 랜딩 섹션에서 뽑아 쓴다. 손으로 적어두면 섹션을 늘리거나
// 이름을 바꿔도 이 줄만 남아, LLM이 없는 기능으로 읽거나 있는 기능을 놓친다.
const flowSteps = learningFlowContent.scenes
  .map((scene) => scene.eyebrow)
  .join("·");
const toolNames = learningToolsContent.tools
  .map((tool) => tool.label)
  .join("·");

/* 학습 가이드는 본문이 채워진 문서만 싣는다. 대응하는 .md 라우트가 없어 HTML URL을
   그대로 가리키는데, 이 URL들은 robots.txt에서 크롤이 허용돼 있어 수집에 문제가 없다. */
function renderGuideSection(): string[] {
  const publishedGuides = getPublishedGuideDocuments();

  if (publishedGuides.length === 0) {
    return [];
  }

  return [
    "## 학습 가이드",
    "",
    ...publishedGuides.map(
      (document) =>
        `- [${document.heading}](${SITE_URL}${getGuideRoute(document.slug)}): ${document.summary}`,
    ),
    "",
  ];
}

function renderLlmsTxt(): string {
  return [
    "# 딱다구리",
    "",
    `> ${landingDescription}`,
    "",
    "## 주요 페이지",
    "",
    `- [서비스 소개](${SITE_URL}/index.md): 학습 흐름(${flowSteps}), 학습 도구(${toolNames}), 자주 묻는 질문`,
    `- [개인정보 처리방침](${SITE_URL}/privacy.md): 처리 항목, 보유 기간, 위탁·국외 이전, 정보주체 권리 등 14개 조항`,
    `- [이용약관](${SITE_URL}/terms.md): 서비스 범위, AI 이용, 회원 콘텐츠, 이용 제한 등 15개 조항`,
    "",
    ...renderGuideSection(),
    "## 통합 문서",
    "",
    `- [전체 콘텐츠](${SITE_URL}/llms-full.txt): 위 문서를 단일 마크다운으로 연결`,
    "",
  ].join("\n");
}

// llms.txt는 대응하는 HTML 페이지가 없어 canonical로 가리킬 대표 URL이 없다.
// markdownResponse가 대신 X-Robots-Tag: noindex를 붙여 검색 색인에서만 뺀다.
export function GET(): Response {
  return markdownResponse(renderLlmsTxt());
}
