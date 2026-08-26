import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

const { logoutActionMock, usePathnameMock } = vi.hoisted(() => ({
  logoutActionMock: vi.fn(),
  usePathnameMock: vi.fn(),
}));

vi.mock("@/features/mypage/actions", () => ({
  logoutAction: logoutActionMock,
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

import { MobileMenu } from "../MobileMenu";

describe("MobileMenu", () => {
  beforeEach(() => {
    logoutActionMock.mockReset();
    usePathnameMock.mockReturnValue(ROUTES.NOTES);
  });

  it("햄버거 버튼으로 학습·계정 메뉴를 연다", () => {
    render(
      <MobileMenu
        nickname="딱다구리"
        email="user@example.com"
        avatarUrl={null}
        isAdmin={false}
      />,
    );

    const trigger = screen.getByRole("button", { name: "메뉴 열기" });
    fireEvent.click(trigger);

    expect(
      screen.getByRole("navigation", { name: "모바일 주 메뉴" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "노트 목록" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "오늘의 복습" })).toHaveAttribute(
      "href",
      ROUTES.NOTES_TODAY,
    );
    expect(screen.getByRole("link", { name: "새 노트" })).toHaveAttribute(
      "href",
      ROUTES.NOTES_NEW,
    );
    expect(screen.getByRole("link", { name: "노트 챗봇" })).toHaveAttribute(
      "href",
      ROUTES.NOTE_CHATS,
    );
    expect(screen.getByRole("link", { name: "마이페이지" })).toHaveAttribute(
      "href",
      ROUTES.MYPAGE,
    );
    expect(
      screen.queryByRole("link", { name: "관리자 페이지" }),
    ).not.toBeInTheDocument();
  });

  it("관리자에게 관리자 페이지 링크를 표시한다", () => {
    render(
      <MobileMenu
        nickname="관리자"
        email="admin@example.com"
        avatarUrl={null}
        isAdmin
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));

    expect(screen.getByRole("link", { name: "관리자 페이지" })).toHaveAttribute(
      "href",
      ROUTES.ADMIN.DASHBOARD,
    );
  });
});
