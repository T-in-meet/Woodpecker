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
    expect(
      screen.queryByRole("link", { name: "오늘의 복습" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "노트 작성" })).toHaveAttribute(
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

  /* 로그인 후 푸터는 데스크톱에만 붙으므로, 모바일에서 법적 문서로 가는
     경로는 이 메뉴가 유일하다. */
  it("법적 고지 문서로 가는 링크를 표시한다", () => {
    render(
      <MobileMenu
        nickname="딱다구리"
        email="user@example.com"
        avatarUrl={null}
        isAdmin={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));

    expect(screen.getByRole("link", { name: "이용약관" })).toHaveAttribute(
      "href",
      ROUTES.TERMS,
    );
    expect(
      screen.getByRole("link", { name: "개인정보처리방침" }),
    ).toHaveAttribute("href", ROUTES.PRIVACY);
  });
});
