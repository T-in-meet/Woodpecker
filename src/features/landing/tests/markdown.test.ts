import { describe, expect, it } from "vitest";

import { GET as getLlmsTxt } from "@/app/llms.txt/route";
import { landingDescription } from "@/features/landing/content";
import { faqs } from "@/features/landing/FaqSection";
import { renderLandingMarkdown } from "@/features/landing/markdown";

describe("랜딩 소개 문서", () => {
  it("현재 복습 흐름과 모든 FAQ를 마크다운에 제공한다", () => {
    const markdown = renderLandingMarkdown();

    expect(markdown).toContain(
      "백지 테스트와 AI 피드백으로 기억할 때까지 반복해요.",
    );
    expect(markdown).toContain(
      "간격을 두고 다시 떠올리는 연습, 기록부터 복습까지 세 단계로 이어가세요.",
    );
    // 화면에만 있고 문서에는 빠지는 카피가 생기지 않게 함께 검증한다.
    expect(markdown).toContain("**읽는 복습에서, 떠올리는 복습으로.**");
    expect(markdown).toContain("복습 방식도 한 가지일 필요는 없어요.");
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

  // 요약은 랜딩 섹션에서 뽑아 쓰므로 이름을 바꾸면 여기서 먼저 걸린다.
  // 그때는 이 기대값을 함께 고쳐 llms.txt와 index.md가 갈라지지 않게 한다.
  it("LLM 소개의 index.md 요약이 랜딩 섹션 구성을 따른다", async () => {
    const response = getLlmsTxt();

    expect(await response.text()).toContain(
      "학습 흐름(기록·알림·백지 테스트), 학습 도구(퀴즈·관련 노트·노트 챗봇), 자주 묻는 질문",
    );
  });
});
