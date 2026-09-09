import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ROUTES } from "@/lib/constants/routes";

const { logoutActionMock } = vi.hoisted(() => ({
  logoutActionMock: vi.fn(),
}));

vi.mock("@/features/mypage/actions", () => ({
  logoutAction: logoutActionMock,
}));

import { UserMenu } from "../UserMenu";

function renderUserMenu() {
  return render(
    <UserMenu
      nickname="딱다구리"
      email="user@example.com"
      avatarUrl={null}
      isAdmin={false}
    />,
  );
}

describe("UserMenu", () => {
  beforeEach(() => {
    logoutActionMock.mockReset();
  });

  /* 노트 챗봇처럼 페이지 스크롤이 제한된 화면에서는 푸터 대신 이 메뉴가
     법적 문서 접근 경로가 된다. */
  it("법적 고지 문서로 가는 링크를 표시한다", () => {
    renderUserMenu();

    fireEvent.click(screen.getByRole("button", { name: "사용자 메뉴 열기" }));

    expect(
      screen.getByRole("navigation", { name: "법적 고지" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "이용약관" })).toHaveAttribute(
      "href",
      ROUTES.TERMS,
    );
    expect(
      screen.getByRole("link", { name: "개인정보처리방침" }),
    ).toHaveAttribute("href", ROUTES.PRIVACY);
  });

  it("법적 고지 링크를 누르면 메뉴가 닫힌다", () => {
    renderUserMenu();

    fireEvent.click(screen.getByRole("button", { name: "사용자 메뉴 열기" }));

    // jsdom은 링크 기본 동작(내비게이션)을 지원하지 않으므로 막고 onClick만 검증한다.
    const termsLink = screen.getByRole("link", { name: "이용약관" });
    termsLink.addEventListener("click", (e) => e.preventDefault());
    fireEvent.click(termsLink);

    expect(
      screen.queryByRole("link", { name: "이용약관" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "사용자 메뉴 열기" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("메뉴가 닫혀 있으면 법적 고지 링크를 렌더링하지 않는다", () => {
    renderUserMenu();

    expect(
      screen.queryByRole("navigation", { name: "법적 고지" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "개인정보처리방침" }),
    ).not.toBeInTheDocument();
  });
});
