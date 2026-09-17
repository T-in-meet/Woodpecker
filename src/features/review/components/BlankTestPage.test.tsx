import { act, fireEvent, render, screen } from "@testing-library/react";
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
  BlankEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      data-testid="blank-editor"
      aria-label="답안"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
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
    history.replaceState(null, "", "/notes/test/review");
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
      screen.getByText("비교를 마쳤다면 이번 복습을 완료해 주세요."),
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

function renderDraft(restoredSession: RestoredReviewSession | null = null) {
  return render(
    <BlankTestPage
      noteId={NOTE_ID}
      noteTitle="테스트"
      restoredSession={restoredSession}
      reviewRound={1}
    />,
  );
}
function beforeUnload() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

describe("미제출 답안 보호", () => {
  beforeEach(() => {
    useActionStateMock.mockReturnValue([null, vi.fn(), false]);
    history.replaceState(null, "", "/notes/test/review");
  });
  it("공백은 보호하지 않고 입력 후 보호하며 모두 지우면 해제한다", () => {
    renderDraft();
    expect(beforeUnload()).toBe(false);
    fireEvent.change(screen.getByLabelText("답안"), {
      target: { value: "  " },
    });
    expect(beforeUnload()).toBe(false);
    fireEvent.change(screen.getByLabelText("답안"), {
      target: { value: "내 답안" },
    });
    expect(beforeUnload()).toBe(true);
    fireEvent.change(screen.getByLabelText("답안"), { target: { value: "" } });
    expect(beforeUnload()).toBe(false);
  });
  it("내부 이동에 자체 모달을 열고 취소하면 답안을 보존하며 확정하면 이동한다", async () => {
    const user = userEvent.setup();
    renderDraft();
    fireEvent.change(screen.getByLabelText("답안"), {
      target: { value: "내 답안" },
    });
    await act(async () => {
      history.pushState(null, "", "/notes");
    });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/notes/test/review");
    await user.click(screen.getByRole("button", { name: "계속 작성" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("답안")).toHaveValue("내 답안");
    await act(async () => {
      history.pushState(null, "", "/notes");
    });
    await user.click(screen.getByRole("button", { name: "답안 버리고 이동" }));
    expect(window.location.pathname).toBe("/notes");
  });
  it("제출 중과 실패에는 보호를 유지하고 비교 화면에 진입하면 해제한다", () => {
    const { rerender } = renderDraft();
    fireEvent.change(screen.getByLabelText("답안"), {
      target: { value: "내 답안" },
    });
    for (const response of [
      [null, vi.fn(), true],
      [{ error: "다시 시도해주세요" }, vi.fn(), false],
    ]) {
      useActionStateMock.mockReturnValue(response);
      rerender(
        <BlankTestPage
          noteId={NOTE_ID}
          noteTitle="테스트"
          restoredSession={null}
          reviewRound={1}
        />,
      );
      expect(beforeUnload()).toBe(true);
    }
    mockComparisonState();
    rerender(
      <BlankTestPage
        noteId={NOTE_ID}
        noteTitle="테스트"
        restoredSession={null}
        reviewRound={1}
      />,
    );
    expect(beforeUnload()).toBe(false);
  });
  it("복원 결과와 빈 재작성은 보호하지 않고 재입력하면 보호한다", async () => {
    renderDraft(RESTORED_SESSION);
    expect(beforeUnload()).toBe(false);
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "답안 다시 작성" }));
    expect(beforeUnload()).toBe(false);
    fireEvent.change(screen.getByLabelText("답안"), {
      target: { value: "새 답안" },
    });
    expect(beforeUnload()).toBe(true);
  });
});
