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

  it("opens the notification time settings in a dialog", async () => {
    const user = userEvent.setup();
    render(
      <NotificationTimePicker
        noteId={NOTE_ID}
        initialTime="21:30:00"
        nextReviewAt="2026-04-30T12:30:00.000Z"
      />,
    );

    expect(
      screen.getByRole("button", { name: "다음 알림 시간 설정" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("현재 설정: 21:30 KST")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "다음 알림 시간 설정" }),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("현재 설정: 21:30 KST")).toBeInTheDocument();
    expect(screen.getByText(/다음 복습 예정/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "오전 오후 전환, 현재 오후",
      }),
    ).toHaveTextContent("오후");
    expect(screen.getByLabelText("시")).toHaveValue("09");
    expect(screen.getByLabelText("분")).toHaveValue("30");
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

    await user.click(
      screen.getByRole("button", { name: "다음 알림 시간 설정" }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "오전 오후 전환, 현재 오전",
      }),
    );
    fireEvent.change(screen.getByLabelText("시"), {
      target: { value: "9" },
    });
    fireEvent.change(screen.getByLabelText("분"), {
      target: { value: "30" },
    });
    await user.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() => {
      expect(setNotificationTimeActionMock).toHaveBeenCalledWith(
        NOTE_ID,
        "21:30",
      );
    });
    expect(refreshMock).toHaveBeenCalledOnce();
    expect(
      await screen.findByText("알림 시간이 저장되었습니다. (21:30)"),
    ).toBeInTheDocument();
  });

  it("toggles the visible period by click and arrow keys", async () => {
    const user = userEvent.setup();
    render(
      <NotificationTimePicker
        noteId={NOTE_ID}
        initialTime={null}
        nextReviewAt={null}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "다음 알림 시간 설정" }),
    );

    const morningButton = screen.getByRole("button", {
      name: "오전 오후 전환, 현재 오전",
    });
    expect(morningButton).toHaveTextContent("오전");

    await user.click(morningButton);

    expect(
      screen.getByRole("button", {
        name: "오전 오후 전환, 현재 오후",
      }),
    ).toHaveTextContent("오후");

    await user.keyboard("{ArrowDown}");

    expect(
      screen.getByRole("button", {
        name: "오전 오후 전환, 현재 오전",
      }),
    ).toHaveTextContent("오전");
  });

  it("syncs a selected browser time with the visible inputs", async () => {
    const user = userEvent.setup();
    render(
      <NotificationTimePicker
        noteId={NOTE_ID}
        initialTime={null}
        nextReviewAt={null}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "다음 알림 시간 설정" }),
    );

    expect(
      screen.getByRole("button", { name: "시간 선택하기" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("native-time-input"), {
      target: { value: "08:15" },
    });

    expect(
      screen.getByRole("button", {
        name: "오전 오후 전환, 현재 오전",
      }),
    ).toHaveTextContent("오전");
    expect(screen.getByLabelText("시")).toHaveValue("08");
    expect(screen.getByLabelText("분")).toHaveValue("15");

    await user.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() => {
      expect(setNotificationTimeActionMock).toHaveBeenCalledWith(
        NOTE_ID,
        "08:15",
      );
    });
  });

  it("syncs local state when the initial time changes after mount", async () => {
    const user = userEvent.setup();
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

    await user.click(
      screen.getByRole("button", { name: "다음 알림 시간 설정" }),
    );

    expect(screen.getByText("현재 설정: 21:30 KST")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "오전 오후 전환, 현재 오후",
      }),
    ).toHaveTextContent("오후");
    expect(screen.getByLabelText("시")).toHaveValue("09");
    expect(screen.getByLabelText("분")).toHaveValue("30");
  });

  it("shows a fallback error message when the server action rejects", async () => {
    setNotificationTimeActionMock.mockRejectedValueOnce(
      new Error("network error"),
    );
    const user = userEvent.setup();
    render(
      <NotificationTimePicker
        noteId={NOTE_ID}
        initialTime={null}
        nextReviewAt={null}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "다음 알림 시간 설정" }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "오전 오후 전환, 현재 오전",
      }),
    );
    fireEvent.change(screen.getByLabelText("시"), {
      target: { value: "9" },
    });
    fireEvent.change(screen.getByLabelText("분"), {
      target: { value: "30" },
    });
    await user.click(screen.getByRole("button", { name: /저장/ }));

    expect(
      await screen.findByText(
        "알림 시간 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      ),
    ).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
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

    await user.click(
      screen.getByRole("button", { name: "다음 알림 시간 설정" }),
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
