import {
  landingDescription,
  learningFlowContent,
  learningToolsContent,
} from "@/features/landing/content";
import { SITE_URL } from "@/lib/constants/site";

export const dynamic = "force-static";

// index.md 요약은 랜딩 섹션에서 뽑아 쓴다. 손으로 적어두면 섹션을 늘리거나
// 이름을 바꿔도 이 줄만 남아, LLM이 없는 기능으로 읽거나 있는 기능을 놓친다.
const flowSteps = learningFlowContent.scenes
  .map((scene) => scene.eyebrow)
  .join("·");
const toolNames = learningToolsContent.tools
  .map((tool) => tool.label)
  .join("·");

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
    "## 통합 문서",
    "",
    `- [전체 콘텐츠](${SITE_URL}/llms-full.txt): 위 3개 문서를 단일 마크다운으로 연결`,
    "",
  ].join("\n");
}

export function GET(): Response {
  return new Response(renderLlmsTxt(), {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
