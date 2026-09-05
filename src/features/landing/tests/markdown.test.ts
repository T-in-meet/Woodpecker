import { describe, expect, it } from "vitest";

import { GET as getLlmsTxt } from "@/app/llms.txt/route";
import { landingDescription } from "@/features/landing/content";
import { faqs } from "@/features/landing/FaqSection";
import { renderLandingMarkdown } from "@/features/landing/markdown";

describe("랜딩 소개 문서", () => {
  it("현재 복습 흐름과 모든 FAQ를 마크다운에 제공한다", () => {
    const markdown = renderLandingMarkdown();

    expect(markdown).toContain(
      "복습 알림부터 백지 테스트, AI 피드백까지 한곳에서.",
    );
    expect(markdown).toContain(
      "간격을 두고 다시 떠올리는 연습, 기록부터 복습까지 세 단계로 이어가세요.",
    );
    expect(markdown).toContain("현재 딱다구리는 무료로 이용할 수 있습니다.");
    expect(markdown).toContain("### 퀴즈 — 문제로 풀며 이해를 확인하세요");
    expect(markdown).toContain("관련된 노트를 직접 연결하거나 AI 추천을 받아");
    expect(markdown).toContain("### 노트 챗봇 — 내 기록에 질문하세요");
    for (const faq of faqs) {
      expect(markdown).toContain(`### ${faq.question}\n\n${faq.answer}`);
    }
  });

  it("이전 일정·베타·효과 보장 문구를 노출하지 않는다", () => {
    expect(renderLandingMarkdown()).not.toMatch(
      /1-3-7|67%|\+50%|베타|무료로 유지할 예정|본인만 접근|기억은 딱다구리가 책임|핵심 개념 포함/,
    );
  });

  it("LLM 소개에도 공통 서비스 설명을 제공한다", async () => {
    const response = getLlmsTxt();

    expect(await response.text()).toContain(`> ${landingDescription}`);
  });
});
