import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { faqs, FaqSection } from "@/features/landing/FaqSection";

/* 이 테스트가 지키는 건 화면 동작이 아니라 색인 가능성이다.
   Radix Accordion은 닫힌 content를 언마운트하므로 forceMount가 빠지면
   검색엔진과 JS를 실행하지 않는 AI 크롤러가 받는 HTML에서 답변 전문이
   사라진다. 열림/닫힘 표시는 CSS(data-closed:invisible)가 맡으므로
   여기서는 DOM에 남아 있는지와 data-state만 확인한다. */
function contentOf(answer: string): HTMLElement {
  const content = screen
    .getByText(answer)
    .closest('[data-slot="accordion-content"]');

  if (!(content instanceof HTMLElement)) {
    throw new Error(`답변이 accordion-content 안에 없다: ${answer}`);
  }

  return content;
}

describe("FaqSection", () => {
  it("모든 항목이 닫힌 초기 상태에서도 답변 전문이 DOM에 남는다", () => {
    render(<FaqSection />);

    for (const faq of faqs) {
      expect(contentOf(faq.answer)).toHaveAttribute("data-state", "closed");
    }
  });

  it("질문을 누르면 그 답변만 열린다", () => {
    render(<FaqSection />);

    fireEvent.click(screen.getByRole("button", { name: faqs[0].question }));

    expect(contentOf(faqs[0].answer)).toHaveAttribute("data-state", "open");
    expect(contentOf(faqs[1].answer)).toHaveAttribute("data-state", "closed");
  });
});
