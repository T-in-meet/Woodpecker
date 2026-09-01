import "./setup";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NoteManageMenu } from "../components/NoteManageMenu";

const {
  lazyPickerRenderMock,
  preloadNotificationSchedulePickerMock,
  setNoteReviewCompletedActionMock,
} = vi.hoisted(() => ({
  lazyPickerRenderMock: vi.fn(),
  preloadNotificationSchedulePickerMock: vi.fn(),
  setNoteReviewCompletedActionMock: vi.fn(),
}));

vi.mock("../actions", () => ({
  deleteNoteAction: vi.fn(),
  setNoteReviewCompletedAction: setNoteReviewCompletedActionMock,
}));

vi.mock("@/features/notifications/actions", () => ({
  setNotificationTimeAction: vi.fn(),
}));

vi.mock(
  "@/features/notifications/components/LazyNotificationSchedulePicker",
  () => ({
    preloadNotificationSchedulePicker: preloadNotificationSchedulePickerMock,
    LazyNotificationSchedulePicker: ({ open }: { open: boolean }) => {
      lazyPickerRenderMock(open);

      return open ? (
        <div role="dialog">
          <p>현재 설정: 5월 1일 (금) 오후 09:30</p>
        </div>
      ) : null;
    },
  }),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function renderMenu({
  onEdit = vi.fn(),
  onEditIntent = vi.fn(),
  canChangeNotificationTime = true,
  isCompletedByUser = false,
}: {
  onEdit?: () => void;
  onEditIntent?: () => void;
  canChangeNotificationTime?: boolean;
  isCompletedByUser?: boolean;
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

  render(
    <QueryClientProvider client={queryClient}>
      <NoteManageMenu
        noteId="note-123"
        noteTitle="노트 제목"
        onEdit={onEdit}
        onEditIntent={onEditIntent}
        isCompletedByUser={isCompletedByUser}
        canChangeNotificationTime={canChangeNotificationTime}
        notificationTimeOfDay="21:30:00"
        nextScheduledAt="2026-05-01T12:30:00.000Z"
      />
    </QueryClientProvider>,
  );

  return { invalidateQueriesSpy, onEdit, onEditIntent };
}

describe("NoteManageMenu", () => {
  beforeEach(() => {
    lazyPickerRenderMock.mockClear();
    preloadNotificationSchedulePickerMock.mockClear();
    setNoteReviewCompletedActionMock
      .mockReset()
      .mockResolvedValue({ data: { completed: true } });
  });

  it("진행 중인 노트에는 복습 완료로 표시를 노출한다", async () => {
    const user = userEvent.setup();
    const { invalidateQueriesSpy } = renderMenu();

    await user.click(screen.getByRole("button", { name: "노트 관리 메뉴" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "복습 완료로 표시" }),
    );

    await waitFor(() => {
      expect(setNoteReviewCompletedActionMock).toHaveBeenCalledWith(
        "note-123",
        true,
      );
      expect(invalidateQueriesSpy).toHaveBeenCalledWith({
        queryKey: ["notifications"],
      });
    });
  });

  it("완료 표시한 노트에는 복습 다시 시작을 노출한다", async () => {
    const user = userEvent.setup();
    renderMenu({ isCompletedByUser: true });

    await user.click(screen.getByRole("button", { name: "노트 관리 메뉴" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "복습 다시 시작" }),
    );

    await waitFor(() => {
      expect(setNoteReviewCompletedActionMock).toHaveBeenCalledWith(
        "note-123",
        false,
      );
    });
  });

  it("메뉴를 열기 전에는 항목이 보이지 않는다", () => {
    renderMenu();

    expect(
      screen.getByRole("button", { name: "노트 관리 메뉴" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "노트 수정" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "복습 일정 변경" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "노트 삭제" }),
    ).not.toBeInTheDocument();
    expect(lazyPickerRenderMock).not.toHaveBeenCalled();
  });

  it("복습 일정 변경을 선택하면 알림 다이얼로그를 연다", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "노트 관리 메뉴" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "복습 일정 변경" }),
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      await screen.findByText("현재 설정: 5월 1일 (금) 오후 09:30"),
    ).toBeInTheDocument();
  });

  it("학습을 마친 노트에는 복습 일정 변경을 노출하지 않는다", async () => {
    const user = userEvent.setup();
    renderMenu({ canChangeNotificationTime: false });

    await user.click(screen.getByRole("button", { name: "노트 관리 메뉴" }));

    expect(
      await screen.findByRole("menuitem", { name: "노트 수정" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: "복습 일정 변경" }),
    ).not.toBeInTheDocument();
  });

  it("수정을 선택하면 onEdit을 호출한다", async () => {
    const user = userEvent.setup();
    const { onEdit } = renderMenu();

    await user.click(screen.getByRole("button", { name: "노트 관리 메뉴" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "노트 수정" }),
    );

    // 메뉴가 포커스를 트리거로 되돌린 다음 한 프레임 뒤에 호출된다.
    await waitFor(() => {
      expect(onEdit).toHaveBeenCalledOnce();
    });
  });

  it("수정 항목에 사용자 의도가 감지되면 편집기를 미리 요청한다", async () => {
    const user = userEvent.setup();
    const onEditIntent = vi.fn();
    renderMenu({ onEditIntent });

    await user.click(screen.getByRole("button", { name: "노트 관리 메뉴" }));
    const editItem = await screen.findByRole("menuitem", { name: "노트 수정" });
    onEditIntent.mockClear();

    fireEvent.pointerEnter(editItem);
    expect(onEditIntent).toHaveBeenCalledOnce();
  });

  it("일정 변경 항목에 사용자 의도가 감지되면 선택기를 미리 요청한다", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "노트 관리 메뉴" }));
    const scheduleItem = await screen.findByRole("menuitem", {
      name: "복습 일정 변경",
    });
    preloadNotificationSchedulePickerMock.mockClear();

    fireEvent.pointerEnter(scheduleItem);
    expect(preloadNotificationSchedulePickerMock).toHaveBeenCalledOnce();
    expect(lazyPickerRenderMock).not.toHaveBeenCalled();
  });

  it("삭제를 선택하면 확인 다이얼로그를 연다", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "노트 관리 메뉴" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "노트 삭제" }),
    );

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      await screen.findByText(
        "삭제한 노트는 되돌릴 수 없습니다. 아래 노트를 영구적으로 삭제하시겠습니까?",
      ),
    ).toBeInTheDocument();
  });
});
