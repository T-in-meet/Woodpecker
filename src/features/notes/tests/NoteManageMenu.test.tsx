import "./setup";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NoteManageMenu } from "../components/NoteManageMenu";

vi.mock("../actions", () => ({
  deleteNoteAction: vi.fn(),
}));

vi.mock("@/features/notifications/actions", () => ({
  setNotificationTimeAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

function renderMenu({
  onEdit = vi.fn(),
  canChangeNotificationTime = true,
}: { onEdit?: () => void; canChangeNotificationTime?: boolean } = {}) {
  render(
    <NoteManageMenu
      noteId="note-123"
      noteTitle="노트 제목"
      onEdit={onEdit}
      canChangeNotificationTime={canChangeNotificationTime}
      notificationTimeOfDay="21:30:00"
      nextScheduledAt="2026-05-01T12:30:00.000Z"
    />,
  );

  return { onEdit };
}

describe("NoteManageMenu", () => {
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

    expect(onEdit).toHaveBeenCalledOnce();
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
