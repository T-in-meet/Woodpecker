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

vi.mock("@/features/notifications/components/NotificationTimePicker", () => ({
  NotificationTimePicker: () => <div data-testid="notification-time-picker" />,
}));

vi.mock("./DeleteNoteDialog", () => ({
  DeleteNoteDialog: () => <button type="button">노트 삭제</button>,
}));

import { NoteDetailBody } from "../components/NoteDetailBody";

function renderBody() {
  return render(
    <NoteDetailBody
      noteId="note-123"
      title="원래 제목"
      content="원래 내용"
      reviewRound={1}
      isReviewCompleted={false}
      canStartReview={true}
      reviewStatusMessage="다음 예정: 내일"
      notificationTimeOfDay={null}
      nextScheduledAt={null}
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

  it("switches into edit mode when the edit button is clicked", async () => {
    const user = userEvent.setup();
    renderBody();

    await user.click(screen.getByRole("button", { name: "노트 수정" }));

    expect(screen.getByLabelText("제목")).toHaveValue("원래 제목");
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
});
