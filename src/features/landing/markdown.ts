import {
  ctaContent,
  heroContent,
  learningFlowContent,
  learningToolsContent,
} from "@/features/landing/content";
import { faqs } from "@/features/landing/FaqSection";
import { ROUTES } from "@/lib/constants/routes";
import { SITE_URL } from "@/lib/constants/site";

export function renderLandingMarkdown(): string {
  const lines: string[] = [];

  lines.push(`# 딱다구리 — ${heroContent.title}`);
  lines.push("");
  lines.push(`> ${heroContent.description.replace(/\n/g, " ")}`);
  lines.push("");
  lines.push(`[무료로 시작하기](${SITE_URL}${ROUTES.SIGNUP})`);
  lines.push("");

  lines.push(`## ${learningFlowContent.heading.replace(/\n/g, " ")}`);
  lines.push("");
  lines.push(learningFlowContent.introduction.replace(/\n/g, " "));
  lines.push("");

  for (const scene of learningFlowContent.scenes) {
    lines.push(
      `### ${scene.step}. ${scene.eyebrow} — ${scene.title.replace(/\n/g, " ")}`,
    );
    lines.push("");
    // 서브헤드는 일부 단계에만 있다. 화면과 문서가 갈라지지 않게 있으면 싣는다.
    if ("subhead" in scene) {
      lines.push(`**${scene.subhead}**`);
      lines.push("");
    }
    lines.push(scene.description);
    lines.push("");
  }

  // 세 단계 뒤의 중간 CTA. 화면에만 있고 문서에는 빠지는 카피를 만들지 않는다.
  lines.push(learningFlowContent.cta.text);
  lines.push("");
  lines.push(`[${learningFlowContent.cta.label}](${SITE_URL}${ROUTES.SIGNUP})`);
  lines.push("");

  // 커넥터는 화면에서 제목 위에 있다. 읽는 순서를 화면과 맞춘다.
  lines.push(learningToolsContent.connector);
  lines.push("");
  lines.push(`## ${learningToolsContent.heading}`);
  lines.push("");
  lines.push(learningToolsContent.description);
  lines.push("");
  for (const tool of learningToolsContent.tools) {
    lines.push(`### ${tool.label} — ${tool.title}`);
    lines.push("");
    lines.push(tool.description);
    lines.push("");
  }

  lines.push("## 자주 묻는 질문");
  lines.push("");
  for (const faq of faqs) {
    lines.push(`### ${faq.question}`);
    lines.push("");
    lines.push(faq.answer);
    lines.push("");
  }

  lines.push(`## ${ctaContent.title.replace(/\n/g, " ")}`);
  lines.push("");
  lines.push(ctaContent.description.replace(/\n/g, " "));
  lines.push("");
  lines.push(`[${ctaContent.ctaLabel}](${SITE_URL}${ROUTES.SIGNUP})`);
  lines.push("");

  return lines.join("\n");
}
