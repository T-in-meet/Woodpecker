import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
/** KST 2026-05-01(금) 09:00. 날짜 선택의 "오늘"이 되는 시각. */
const NOW = new Date("2026-05-01T00:00:00.000Z");
/** KST 2026-05-01(금) 21:30. */
const SCHEDULED_AT = "2026-05-01T12:30:00.000Z";

const {
  refreshMock,
  setNotificationScheduleActionMock,
  setNotificationTimeActionMock,
} = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  setNotificationScheduleActionMock: vi.fn(),
  setNotificationTimeActionMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
  }),
}));

vi.mock("../actions", () => ({
  setNotificationScheduleAction: setNotificationScheduleActionMock,
  setNotificationTimeAction: setNotificationTimeActionMock,
}));

import { NotificationSchedulePicker } from "../components/NotificationSchedulePicker";

/**
 * 다이얼로그는 트리거를 갖지 않는다. 실제 앱에서는 노트 관리 메뉴가 열어 주므로,
 * 테스트에서도 같은 역할을 하는 버튼을 두고 열림 상태를 넘긴다.
 */
function PickerWithTrigger(
  props: Omit<
    ComponentProps<typeof NotificationSchedulePicker>,
    "open" | "onOpenChange"
  >,
) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        복습 일정 변경
      </button>
      <NotificationSchedulePicker
        {...props}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "복습 일정 변경" }));
}

async function selectDate(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  await user.click(screen.getByRole("option", { name: label }));
}

describe("NotificationSchedulePicker", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(NOW);
    refreshMock.mockReset();
    setNotificationScheduleActionMock.mockReset();
    setNotificationScheduleActionMock.mockResolvedValue({ success: true });
    setNotificationTimeActionMock.mockReset();
    setNotificationTimeActionMock.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("현재 일정을 날짜·요일과 함께 보여준다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    expect(
      screen.queryByText("현재 설정: 5월 1일 (금) 오후 09:30"),
    ).not.toBeInTheDocument();

    await openDialog(user);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByText("현재 설정: 5월 1일 (금) 오후 09:30"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "2026년 5월 1일 (금)" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: "오후 선택" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("시")).toHaveValue("09");
    expect(screen.getByLabelText("분")).toHaveValue("30");
  });

  it("목록에서 고른 날짜와 시간을 함께 저장한다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);
    await selectDate(user, "2026년 5월 5일 (화)");
    await user.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() => {
      expect(setNotificationScheduleActionMock).toHaveBeenCalledWith(
        NOTE_ID,
        "2026-05-05",
        "21:30",
      );
    });
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("빠른 선택 칩으로 날짜를 옮긴다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);
    await user.click(screen.getByRole("button", { name: "3일 뒤" }));

    expect(
      screen.getByText("5월 4일 (월) 오후 09:30에 알림을 보냅니다."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() => {
      expect(setNotificationScheduleActionMock).toHaveBeenCalledWith(
        NOTE_ID,
        "2026-05-04",
        "21:30",
      );
    });
  });

  it("허용 범위의 날짜만 목록에 보여준다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);

    // 오늘은 5월 1일이므로 4월 30일(지난 날)은 없고 5월 31일(+30일)은 노출된다.
    expect(
      screen.queryByRole("option", { name: "2026년 4월 30일 (목)" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "2026년 5월 31일 (일)" }),
    ).toBeInTheDocument();
  });

  it("방향키로 날짜 휠을 한 칸씩 이동한다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);
    screen.getByRole("listbox", { name: "날짜" }).focus();
    await user.keyboard("{ArrowDown}");

    expect(
      screen.getByRole("option", { name: "2026년 5월 2일 (토)" }),
    ).toHaveAttribute("aria-selected", "true");
  });

  it("시간만 바꿔도 저장할 수 있다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);
    await user.click(screen.getByRole("button", { name: "오전 선택" }));
    fireEvent.change(screen.getByLabelText("시"), {
      target: { value: "08" },
    });
    fireEvent.change(screen.getByLabelText("분"), {
      target: { value: "15" },
    });

    await user.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() => {
      expect(setNotificationScheduleActionMock).toHaveBeenCalledWith(
        NOTE_ID,
        "2026-05-01",
        "08:15",
      );
    });
  });

  it("분 입력은 1분 단위 변경을 지원한다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);
    fireEvent.change(screen.getByLabelText("분"), {
      target: { value: "05" },
    });

    expect(screen.getByLabelText("분")).toHaveValue("05");
    expect(
      screen.getByText("5월 1일 (금) 오후 09:05에 알림을 보냅니다."),
    ).toBeInTheDocument();
  });

  it("오전·시·분을 직접 변경한다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);
    await user.click(screen.getByRole("button", { name: "오전 선택" }));
    fireEvent.change(screen.getByLabelText("시"), {
      target: { value: "07" },
    });
    fireEvent.change(screen.getByLabelText("분"), {
      target: { value: "05" },
    });
    await user.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() => {
      expect(setNotificationScheduleActionMock).toHaveBeenCalledWith(
        NOTE_ID,
        "2026-05-01",
        "07:05",
      );
    });
  });

  it("시 입력은 범위 끝에서 12와 1을 순환하지 않는다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);
    const hourInput = screen.getByLabelText("시");

    fireEvent.change(hourInput, { target: { value: "12" } });
    fireEvent.keyDown(hourInput, { key: "ArrowUp" });
    expect(hourInput).toHaveValue("12");

    fireEvent.change(hourInput, { target: { value: "01" } });
    fireEvent.keyDown(hourInput, { key: "ArrowDown" });
    expect(hourInput).toHaveValue("01");
  });

  it("액션이 실패하면 서버가 준 메시지를 보여준다", async () => {
    setNotificationScheduleActionMock.mockResolvedValueOnce({
      success: false,
      error: "이미 발송된 알림은 일정을 바꿀 수 없습니다.",
    });
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);
    await user.click(screen.getByRole("button", { name: "내일" }));
    await user.click(screen.getByRole("button", { name: /저장/ }));

    expect(
      await screen.findByText("이미 발송된 알림은 일정을 바꿀 수 없습니다."),
    ).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("액션이 거부되면 기본 오류 메시지를 보여준다", async () => {
    setNotificationScheduleActionMock.mockRejectedValueOnce(
      new Error("network error"),
    );
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);
    await user.click(screen.getByRole("button", { name: "내일" }));
    await user.click(screen.getByRole("button", { name: /저장/ }));

    expect(
      await screen.findByText(
        "알림 일정 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      ),
    ).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("기본 일정으로 되돌리면 시간 액션을 null로 부른다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);
    await user.click(screen.getByRole("button", { name: /기본 일정/ }));

    await waitFor(() => {
      expect(setNotificationTimeActionMock).toHaveBeenCalledWith(NOTE_ID, null);
    });
    expect(refreshMock).toHaveBeenCalledOnce();
    expect(
      await screen.findByText("기본 복습 일정을 사용합니다."),
    ).toBeInTheDocument();
  });

  it("사용자 지정 시간이 없으면 기본 일정 버튼을 비활성화한다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime={null}
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);

    expect(screen.getByRole("button", { name: /기본 일정/ })).toBeDisabled();
  });
});
