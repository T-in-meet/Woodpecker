import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";

const { refreshMock, setNotificationTimeActionMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  setNotificationTimeActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock("../actions", () => ({
  setNotificationTimeAction: setNotificationTimeActionMock,
}));

import { NotificationTimePicker } from "../components/NotificationTimePicker";

describe("NotificationTimePicker", () => {
  beforeEach(() => {
    refreshMock.mockReset();
    setNotificationTimeActionMock.mockReset();
    setNotificationTimeActionMock.mockResolvedValue({ success: true });
  });

  it("renders the current note-level notification time", () => {
    render(
      <NotificationTimePicker
        noteId={NOTE_ID}
        initialTime="21:30:00"
        nextReviewAt="2026-04-30T12:30:00.000Z"
      />,
    );

    expect(screen.getByText("현재 설정: 21:30 KST")).toBeInTheDocument();
    expect(screen.getByText(/다음 복습 예정/)).toBeInTheDocument();
    expect(screen.getByLabelText("알림 시간")).toHaveValue("21:30");
  });

  it("saves a changed notification time", async () => {
    const user = userEvent.setup();
    render(
      <NotificationTimePicker
        noteId={NOTE_ID}
        initialTime={null}
        nextReviewAt={null}
      />,
    );

    fireEvent.change(screen.getByLabelText("알림 시간"), {
      target: { value: "09:30" },
    });
    await user.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() => {
      expect(setNotificationTimeActionMock).toHaveBeenCalledWith(
        NOTE_ID,
        "09:30",
      );
    });
    expect(refreshMock).toHaveBeenCalledOnce();
    expect(
      await screen.findByText("알림 시간이 저장되었습니다. (09:30)"),
    ).toBeInTheDocument();
  });

  it("syncs local state when the initial time changes after mount", () => {
    const { rerender } = render(
      <NotificationTimePicker
        noteId={NOTE_ID}
        initialTime="09:30:00"
        nextReviewAt={null}
      />,
    );

    rerender(
      <NotificationTimePicker
        noteId={NOTE_ID}
        initialTime="21:30:00"
        nextReviewAt={null}
      />,
    );

    expect(screen.getByText("현재 설정: 21:30 KST")).toBeInTheDocument();
    expect(screen.getByLabelText("알림 시간")).toHaveValue("21:30");
  });

  it("clears the override and falls back to the default review time", async () => {
    const user = userEvent.setup();
    render(
      <NotificationTimePicker
        noteId={NOTE_ID}
        initialTime="21:30:00"
        nextReviewAt={null}
      />,
    );

    await user.click(screen.getByRole("button", { name: /기본 시간/ }));

    await waitFor(() => {
      expect(setNotificationTimeActionMock).toHaveBeenCalledWith(NOTE_ID, null);
    });
    expect(refreshMock).toHaveBeenCalledOnce();
    expect(
      await screen.findByText("기본 복습 예정 시간을 사용합니다."),
    ).toBeInTheDocument();
  });
});
