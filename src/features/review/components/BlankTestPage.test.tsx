import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GradingResponse } from "../schema";

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

vi.mock("./GradingPanel", () => ({
  GradingPanel: ({
    basisContentChanged,
    initialGrading,
    originalContentHash,
    userAnswer,
  }: {
    basisContentChanged: boolean;
    initialGrading: { score: number } | null;
    originalContentHash: string;
    userAnswer: string;
  }) => (
    <div
      data-basis-changed={String(basisContentChanged)}
      data-content-hash={originalContentHash}
      data-initial-score={initialGrading?.score ?? ""}
      data-testid="grading-panel"
      data-user-answer={userAnswer}
    />
  ),
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

import { BlankTestPage, type RestoredReviewSession } from "./BlankTestPage";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
const REVIEW_LOG_ID = "22222222-2222-4222-8222-222222222222";

const RESTORED_GRADING: GradingResponse = {
  score: 72,
  summary: "저장된 총평",
  missedConcepts: [],
  incorrectPoints: [],
};

const CONTENT_HASH = "a".repeat(64);

const RESTORED_SESSION: RestoredReviewSession = {
  originalContent: "원본",
  originalContentHash: CONTENT_HASH,
  userAnswer: "저장된 답안",
  reviewLogId: REVIEW_LOG_ID,
  grading: RESTORED_GRADING,
  basisContentChanged: false,
};

function mockComparisonState() {
  useActionStateMock.mockReturnValue([
    {
      success: true,
      originalContent: "원본",
      originalContentHash: CONTENT_HASH,
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
        noteId={NOTE_ID}
        noteTitle="테스트 노트"
        restoredSession={null}
        reviewRound={1}
      />,
    );

    // 제목과 안내 문구가 같은 줄바꿈 규칙을 쓰는지 확인한다.
    expect(screen.getByRole("heading", { level: 1 })).toHaveClass(
      "text-prose-ko",
    );
    expect(
      screen.getByText(
        "비교를 마쳤다면 이번 복습을 완료 처리하고 다음 간격으로 넘어가세요.",
      ),
    ).toHaveClass("text-prose-ko");
    expect(
      screen.getByRole("button", { name: "review-complete" }),
    ).toBeEnabled();
  });

  // 채점을 받은 회차로 다시 들어온 경우. 답안을 새로 쓰지 않아도 비교와 결과가 보여야 한다.
  it("restores the saved answer and grading instead of showing a blank editor", () => {
    useActionStateMock.mockReturnValue([null, vi.fn(), false]);

    render(
      <BlankTestPage
        noteId={NOTE_ID}
        noteTitle="테스트 노트"
        restoredSession={RESTORED_SESSION}
        reviewRound={1}
      />,
    );

    expect(screen.getByTestId("comparison-view")).toBeInTheDocument();
    expect(screen.queryByTestId("blank-editor")).not.toBeInTheDocument();

    const gradingPanel = screen.getByTestId("grading-panel");
    expect(gradingPanel).toHaveAttribute("data-initial-score", "72");
    expect(gradingPanel).toHaveAttribute("data-user-answer", "저장된 답안");
    expect(gradingPanel).toHaveAttribute("data-content-hash", CONTENT_HASH);
    expect(gradingPanel).toHaveAttribute("data-basis-changed", "false");
    expect(
      screen.getByRole("button", { name: "review-complete" }),
    ).toHaveAttribute("data-review-log-id", REVIEW_LOG_ID);
  });

  // 채점 이후 노트를 고친 경우. 화면의 원본과 채점 기준이 다르다는 사실이 전달돼야 한다.
  it("forwards the changed grading basis to the grading panel", () => {
    useActionStateMock.mockReturnValue([null, vi.fn(), false]);

    render(
      <BlankTestPage
        noteId={NOTE_ID}
        noteTitle="테스트 노트"
        restoredSession={{ ...RESTORED_SESSION, basisContentChanged: true }}
        reviewRound={1}
      />,
    );

    expect(screen.getByTestId("grading-panel")).toHaveAttribute(
      "data-basis-changed",
      "true",
    );
  });

  it("returns to the blank editor when the user chooses to rewrite the answer", async () => {
    const user = userEvent.setup();
    useActionStateMock.mockReturnValue([null, vi.fn(), false]);

    render(
      <BlankTestPage
        noteId={NOTE_ID}
        noteTitle="테스트 노트"
        restoredSession={RESTORED_SESSION}
        reviewRound={1}
      />,
    );

    await user.click(screen.getByRole("button", { name: "답안 다시 작성" }));

    expect(screen.getByTestId("blank-editor")).toBeInTheDocument();
    expect(screen.queryByTestId("comparison-view")).not.toBeInTheDocument();
  });

  it("does not offer the rewrite button when there is nothing to restore", () => {
    mockComparisonState();

    render(
      <BlankTestPage
        noteId={NOTE_ID}
        noteTitle="테스트 노트"
        restoredSession={null}
        reviewRound={1}
      />,
    );

    // 방금 제출한 답안은 아직 채점 전이므로 복원할 결과가 없다.
    expect(
      screen.queryByRole("button", { name: "답안 다시 작성" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("grading-panel")).toHaveAttribute(
      "data-initial-score",
      "",
    );
  });
});
