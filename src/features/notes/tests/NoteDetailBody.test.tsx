import "./setup";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { updateNoteActionMock, routerRefreshMock, routerMock } = vi.hoisted(
  () => {
    const refresh = vi.fn();
    return {
      updateNoteActionMock: vi.fn(),
      routerRefreshMock: refresh,
      routerMock: { refresh },
    };
  },
);

vi.mock("../actions", () => ({
  updateNoteAction: updateNoteActionMock,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/features/editor/components/TipTapEditor", () => ({
  TipTapEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <button
      type="button"
      data-testid="tiptap-editor"
      onClick={() => onChange("updated content")}
    >
      markdown:{value}
    </button>
  ),
}));

vi.mock("@/features/quiz/components/QuizButton", () => ({
  QuizButton: () => <div data-testid="quiz-button" />,
}));

// vi.mock 경로는 이 테스트 파일 기준으로 해석되므로 상대 경로("./NoteManageMenu")를
// 쓰면 tests/ 아래를 찾다가 조용히 빗나간다. 별칭 경로로 지정한다.
vi.mock("@/features/notes/components/NoteManageMenu", () => ({
  NoteManageMenu: ({ onEdit }: { onEdit: () => void }) => (
    <button type="button" onClick={onEdit}>
      노트 수정
    </button>
  ),
}));

vi.mock("@/features/related-notes/components/RelatedNotesSection", () => ({
  RelatedNotesSection: () => null,
}));

import { NoteDetailBody } from "../components/NoteDetailBody";

function renderBody(props: Partial<Parameters<typeof NoteDetailBody>[0]> = {}) {
  return render(
    <NoteDetailBody
      noteId="note-123"
      title="원래 제목"
      content="원래 내용"
      reviewRound={1}
      isReviewCompleted={false}
      canStartReview={true}
      reviewStatusMessage="다음 복습 일정: 내일"
      notificationTimeOfDay={null}
      nextScheduledAt={null}
      {...props}
    />,
  );
}

describe("NoteDetailBody", () => {
  beforeEach(() => {
    updateNoteActionMock.mockReset();
    updateNoteActionMock.mockResolvedValue(null);
    routerRefreshMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows read-only content by default", () => {
    renderBody();

    expect(
      screen.getByRole("heading", { name: "원래 제목" }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("제목")).not.toBeInTheDocument();
  });

  it("복습 상태 문구를 배지 줄에 함께 보여준다", () => {
    renderBody({
      reviewStatusMessage: "지금 백지 테스트를 진행할 수 있습니다.",
    });

    const badge = screen.getByText("복습 1회");
    const status = screen.getByText("지금 백지 테스트를 진행할 수 있습니다.");

    expect(status).toBeInTheDocument();
    expect(badge.parentElement).toBe(status.parentElement);
  });

  it("switches into edit mode when the edit button is clicked", async () => {
    const user = userEvent.setup();
    renderBody();

    await user.click(screen.getByRole("button", { name: "노트 수정" }));

    // NoteEditForm은 next/dynamic으로 지연 로드되므로 첫 진입에서는 청크 도착을 기다린다.
    expect(await screen.findByLabelText("제목")).toHaveValue("원래 제목");
    expect(screen.getByTestId("tiptap-editor")).toBeInTheDocument();
  });

  it("cancels editing and restores the original values", async () => {
    const user = userEvent.setup();
    renderBody();

    await user.click(screen.getByRole("button", { name: "노트 수정" }));
    await user.clear(screen.getByLabelText("제목"));
    await user.type(screen.getByLabelText("제목"), "바뀐 제목");
    await user.click(screen.getByRole("button", { name: "취소" }));

    expect(
      screen.getByRole("heading", { name: "원래 제목" }),
    ).toBeInTheDocument();
    expect(updateNoteActionMock).not.toHaveBeenCalled();
  });

  it("saves the edited note and returns to read-only mode", async () => {
    const user = userEvent.setup();
    updateNoteActionMock.mockResolvedValueOnce({ success: true });
    renderBody();

    await user.click(screen.getByRole("button", { name: "노트 수정" }));
    await user.click(screen.getByTestId("tiptap-editor"));
    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(routerRefreshMock).toHaveBeenCalledOnce();
    });
    expect(screen.queryByLabelText("제목")).not.toBeInTheDocument();
  });

  it("renders validation errors returned from the action", async () => {
    const user = userEvent.setup();
    updateNoteActionMock.mockResolvedValueOnce({
      error: {
        title: ["제목을 입력해주세요"],
      },
    });
    renderBody();

    await user.click(screen.getByRole("button", { name: "노트 수정" }));
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("제목을 입력해주세요")).toBeInTheDocument();
  });

  it("clears the previous action error when editing is reopened", async () => {
    const user = userEvent.setup();
    updateNoteActionMock.mockResolvedValueOnce({
      error: {
        title: ["제목을 입력해주세요"],
      },
    });
    renderBody();

    await user.click(screen.getByRole("button", { name: "노트 수정" }));
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(await screen.findByText("제목을 입력해주세요")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "취소" }));
    await user.click(screen.getByRole("button", { name: "노트 수정" }));

    expect(screen.getByLabelText("제목")).toBeInTheDocument();
    expect(screen.queryByText("제목을 입력해주세요")).not.toBeInTheDocument();
  });

  it("clears the previous general error when editing is reopened", async () => {
    const user = userEvent.setup();
    updateNoteActionMock.mockResolvedValueOnce({
      error: "노트 수정에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
    renderBody();

    await user.click(screen.getByRole("button", { name: "노트 수정" }));
    await user.click(screen.getByRole("button", { name: "저장" }));
    expect(
      await screen.findByText(
        "노트 수정에 실패했습니다. 잠시 후 다시 시도해주세요.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "취소" }));
    await user.click(screen.getByRole("button", { name: "노트 수정" }));

    expect(
      screen.queryByText(
        "노트 수정에 실패했습니다. 잠시 후 다시 시도해주세요.",
      ),
    ).not.toBeInTheDocument();
  });
});
