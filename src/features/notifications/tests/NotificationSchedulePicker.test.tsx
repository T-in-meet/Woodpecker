import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ComponentProps, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOTE_ID = "11111111-1111-4111-8111-111111111111";
/** KST 2026-05-01(금) 09:00. 날짜 입력의 "오늘"이 되는 시각. */
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

function enterDate(year: string, month: string, day: string) {
  fireEvent.change(screen.getByLabelText("연도"), {
    target: { value: year },
  });
  fireEvent.change(screen.getByLabelText("월"), {
    target: { value: month },
  });
  fireEvent.change(screen.getByLabelText("일"), {
    target: { value: day },
  });
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
    expect(screen.getByLabelText("연도")).toHaveValue("2026");
    expect(screen.getByLabelText("월")).toHaveValue("05");
    expect(screen.getByLabelText("일")).toHaveValue("01");
    expect(screen.getByRole("button", { name: "오후 선택" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("시")).toHaveValue("09");
    expect(screen.getByLabelText("분")).toHaveValue("30");
  });

  it("직접 입력한 날짜와 시간을 함께 저장한다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);
    enterDate("2026", "05", "05");
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

    expect(screen.getByRole("button", { name: "3일 뒤" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "3일 뒤" })).toHaveClass(
      "bg-muted",
    );
    expect(screen.getByRole("button", { name: "내일" })).toHaveClass(
      "hover:bg-muted",
    );
    expect(screen.getByLabelText("연도")).toHaveValue("2026");
    expect(screen.getByLabelText("월")).toHaveValue("05");
    expect(screen.getByLabelText("일")).toHaveValue("04");
    expect(
      screen.queryByText("5월 4일 (월) 오후 09:30에 알림을 보냅니다."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() => {
      expect(setNotificationScheduleActionMock).toHaveBeenCalledWith(
        NOTE_ID,
        "2026-05-04",
        "21:30",
      );
    });
  });

  it("1년 뒤 날짜도 입력해 저장할 수 있다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);
    enterDate("2027", "05", "01");
    expect(
      screen.queryByText("5월 1일 (토) 오후 09:30에 알림을 보냅니다."),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /저장/ }));

    await waitFor(() => {
      expect(setNotificationScheduleActionMock).toHaveBeenCalledWith(
        NOTE_ID,
        "2027-05-01",
        "21:30",
      );
    });
  });

  it("완료 당일에는 오늘 일정만 선택할 수 있다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt="2026-05-03T12:30:00.000Z"
        sameDayOnly
      />,
    );

    await openDialog(user);

    expect(
      screen.getByText(
        "복습 완료 당일에는 오늘의 미래 시각으로만 변경할 수 있습니다. 저장하면 복습이 다시 시작됩니다.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "오늘" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "내일" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /기본 일정/ })).toBeDisabled();
    expect(screen.getByLabelText("일")).toHaveValue("01");

    enterDate("2026", "05", "02");
    fireEvent.blur(screen.getByLabelText("일"));

    expect(
      screen.getByText("오늘 날짜만 입력할 수 있습니다."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /저장/ })).toBeDisabled();
  });

  it("연도와 월 입력을 마치면 다음 입력칸으로 이동한다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);
    fireEvent.change(screen.getByLabelText("연도"), {
      target: { value: "2027" },
    });
    expect(screen.getByLabelText("월")).toHaveFocus();

    fireEvent.change(screen.getByLabelText("월"), {
      target: { value: "08" },
    });
    expect(screen.getByLabelText("일")).toHaveFocus();
  });

  it("존재하지 않는 날짜를 저장하지 못하게 한다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);
    enterDate("2027", "02", "31");
    fireEvent.blur(screen.getByLabelText("일"));

    expect(screen.getByText("존재하지 않는 날짜입니다.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /저장/ })).toBeDisabled();
  });

  it("과거 날짜를 저장하지 못하게 한다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);
    enterDate("2026", "04", "30");
    fireEvent.blur(screen.getByLabelText("일"));

    expect(
      screen.getByText("오늘 이후 날짜를 입력해주세요."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /저장/ })).toBeDisabled();
  });

  it("변경한 내용이 없으면 저장이 비활성인 이유를 알려준다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);

    expect(screen.getByRole("button", { name: /저장/ })).toBeDisabled();
    expect(screen.getByText("변경한 내용이 없어요.")).toBeInTheDocument();
  });

  // 날짜 입력은 blur 전까지 자기 오류를 띄우지 않는다. 그 사이에도 버튼이 왜
  // 죽어 있는지 알 수 있어야 한다.
  it("날짜가 유효하지 않으면 blur 전에도 저장이 비활성인 이유를 알려준다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    await openDialog(user);
    enterDate("2027", "02", "31");
    fireEvent.blur(screen.getByLabelText("일"));

    expect(screen.getByText("날짜를 확인해주세요.")).toBeInTheDocument();
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

  it("완성되지 않은 시간 초안은 Enter로 제출하지 않는다", async () => {
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
    fireEvent.change(screen.getByLabelText("분"), {
      target: { value: "9" },
    });

    const saveButton = screen.getByRole("button", { name: /저장/ });
    expect(saveButton).toBeDisabled();

    const form = saveButton.closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(setNotificationScheduleActionMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("알림 시간이 올바르지 않습니다."),
    ).toBeInTheDocument();
  });

  it("페이지를 열어 둔 사이 자정이 지나면 오늘 날짜를 다시 계산한다", async () => {
    const user = userEvent.setup();
    render(
      <PickerWithTrigger
        noteId={NOTE_ID}
        initialTime="21:30:00"
        initialScheduledAt={SCHEDULED_AT}
      />,
    );

    vi.setSystemTime(new Date("2026-05-01T15:01:00.000Z"));
    await openDialog(user);
    await user.click(screen.getByRole("button", { name: "오늘" }));

    expect(screen.getByLabelText("연도")).toHaveValue("2026");
    expect(screen.getByLabelText("월")).toHaveValue("05");
    expect(screen.getByLabelText("일")).toHaveValue("02");
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
      screen.queryByText("5월 1일 (금) 오후 09:05에 알림을 보냅니다."),
    ).not.toBeInTheDocument();
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
      error: "알림을 보내는 중입니다. 잠시 후 다시 시도해주세요.",
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
      await screen.findByText(
        "알림을 보내는 중입니다. 잠시 후 다시 시도해주세요.",
      ),
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

  it("기본 일정의 수정 초안을 저장 전에도 되돌린다", async () => {
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

    await user.click(screen.getByRole("button", { name: "내일" }));
    expect(screen.getByRole("button", { name: /기본 일정/ })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /기본 일정/ }));

    expect(screen.getByRole("button", { name: /기본 일정/ })).toBeDisabled();
    expect(screen.getByLabelText("연도")).toHaveValue("2026");
    expect(screen.getByLabelText("월")).toHaveValue("05");
    expect(screen.getByLabelText("일")).toHaveValue("01");
    expect(setNotificationTimeActionMock).not.toHaveBeenCalled();
  });
});
