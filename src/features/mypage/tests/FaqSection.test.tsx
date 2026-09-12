import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { FaqSection } from "../components/FaqSection";

describe("FaqSection", () => {
  it("선택한 유형의 FAQ만 보여주고 1:1 문의 FAQ는 제공하지 않는다", async () => {
    const user = userEvent.setup();
    render(<FaqSection />);

    const categoryGroup = screen.getByRole("group", { name: "FAQ 유형" });
    expect(
      within(categoryGroup)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["복습과 학습", "알림과 일정", "노트 관리", "계정 관리"]);
    expect(
      within(categoryGroup).getByRole("button", { name: "복습과 학습" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(categoryGroup).getByRole("button", { name: "복습과 학습" }),
    ).toHaveClass("rounded-full");
    expect(
      within(categoryGroup).getByRole("button", { name: "복습과 학습" }),
    ).toHaveClass("border-black", "bg-black", "hover:bg-black", "text-white");
    expect(
      within(categoryGroup).getByRole("button", { name: "알림과 일정" }),
    ).toHaveClass(
      "border-border",
      "bg-background",
      "hover:bg-muted",
      "text-foreground",
    );
    expect(
      screen.getByRole("button", { name: "복습 주기는 어떻게 되나요?" }),
    ).toHaveClass("cursor-pointer");
    expect(
      screen.queryByRole("button", { name: "복습 알림은 언제 오나요?" }),
    ).not.toBeInTheDocument();

    await user.click(
      within(categoryGroup).getByRole("button", { name: "알림과 일정" }),
    );

    expect(
      within(categoryGroup).getByRole("button", { name: "알림과 일정" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "복습 알림은 언제 오나요?" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "복습 주기는 어떻게 되나요?" }),
    ).not.toBeInTheDocument();

    expect(
      within(categoryGroup).queryByRole("button", { name: "1:1 문의" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "1:1 문의는 얼마나 자주 할 수 있나요?",
      }),
    ).not.toBeInTheDocument();

    await user.click(
      within(categoryGroup).getByRole("button", { name: "복습과 학습" }),
    );

    await user.click(
      screen.getByRole("button", { name: "복습 주기는 어떻게 되나요?" }),
    );
    const reviewCycleAnswer = screen.getByText(
      /30일 단계 이후에도 같은 간격으로 계속 이어지며/,
    );
    expect(reviewCycleAnswer).toBeInTheDocument();
    expect(reviewCycleAnswer.parentElement).not.toHaveClass(
      "h-(--radix-accordion-content-height)",
    );
    expect(screen.queryByText(/총 3번의 복습/)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "하루에 여러 회차를 몰아서 복습할 수 있나요?",
      }),
    );
    expect(
      screen.getByText(/그날 한 번 복습한 것으로만 계산됩니다/),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: "AI 기능은 하루에 몇 번까지 쓸 수 있나요?",
      }),
    ).not.toBeInTheDocument();

    // AI 채점 한도는 UI 어디에도 안내가 없어 한도에 걸려야 알 수 있었다.
    // 퀴즈 한도는 QuizModal 팝오버가 맡고, 채점 한도는 이 FAQ가 유일한 안내다.
    await user.click(
      screen.getByRole("button", {
        name: "AI 채점은 하루에 몇 번까지 받을 수 있나요?",
      }),
    );
    // 한도 카운터는 claim_review_grading이 KST 자정 기준으로 세므로, 시간대 표기가
    // 없으면 한국 밖 사용자가 자기 시간대 자정에 풀린다고 읽는다.
    expect(
      screen.getByText(/사용 횟수는 매일 자정\(한국 시간\)에 초기화됩니다/),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "학습 통계의 연속 학습일과 정시 완료율은 어떻게 계산되나요?",
      }),
    );
    expect(
      screen.getByText(/연속 학습일은 복습을 완료한 날이/),
    ).toBeInTheDocument();
    // 연속 학습일·정시 완료율도 KST 기준으로 계산한다.
    expect(screen.getByText(/모두 한국 시간 기준입니다/)).toBeInTheDocument();
  });
});
