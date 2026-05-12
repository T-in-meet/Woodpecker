import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useActionStateMock } = vi.hoisted(() => ({
  useActionStateMock: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    useActionState: useActionStateMock,
  };
});

vi.mock("../actions", () => ({
  submitAnswerAction: vi.fn(),
}));

vi.mock("./BlankEditor", () => ({
  BlankEditor: () => <div data-testid="blank-editor" />,
}));

vi.mock("./ComparisonView", () => ({
  ComparisonView: () => <div data-testid="comparison-view" />,
}));

vi.mock("./ReviewCompleteButton", () => ({
  ReviewCompleteButton: ({
    disabled,
    noteId,
    reviewLogId,
  }: {
    disabled?: boolean;
    noteId: string;
    reviewLogId: string;
  }) => (
    <button
      data-note-id={noteId}
      data-review-log-id={reviewLogId}
      disabled={disabled}
      type="button"
    >
      review-complete
    </button>
  ),
}));

import { BlankTestPage } from "./BlankTestPage";

function mockComparisonState() {
  useActionStateMock.mockReturnValue([
    {
      success: true,
      originalContent: "원본",
      userAnswer: "답안",
      reviewLogId: "22222222-2222-4222-8222-222222222222",
    },
    vi.fn(),
    false,
  ]);
}

describe("BlankTestPage", () => {
  beforeEach(() => {
    useActionStateMock.mockReset();
  });

  it("keeps the complete button enabled before today's limit is reached", () => {
    mockComparisonState();

    render(
      <BlankTestPage
        alreadyCompletedToday={false}
        noteId="11111111-1111-4111-8111-111111111111"
        noteTitle="테스트 노트"
        reviewRound={1}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveClass(
      "break-words",
      "break-keep",
    );
    expect(
      screen.getByText(
        "비교를 마쳤다면 이번 복습을 완료 처리하고 다음 간격으로 넘어가세요.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "review-complete" }),
    ).toBeEnabled();
  });

  it("disables completion after the note was already completed today", () => {
    mockComparisonState();

    render(
      <BlankTestPage
        alreadyCompletedToday
        noteId="11111111-1111-4111-8111-111111111111"
        noteTitle="테스트 노트"
        reviewRound={1}
      />,
    );

    expect(
      screen.getByText(
        "오늘은 이미 이 노트의 복습을 완료했어요. 내일 자정(KST) 이후 다시 완료할 수 있어요.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "review-complete" }),
    ).toBeDisabled();
  });
});
