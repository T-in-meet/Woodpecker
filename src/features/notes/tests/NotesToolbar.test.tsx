import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotesToolbar } from "../components/NotesToolbar";

const pushMock = vi.fn();

let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => currentSearchParams,
}));

describe("NotesToolbar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    currentSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["all", "전체"],
    ["due", "오늘 복습"],
    ["scheduled", "복습 예정"],
    ["completed", "복습 완료"],
  ] as const)("%s 보기의 이름을 '%s'로 표시한다", (activeView, label) => {
    render(<NotesToolbar initialQuery="" activeView={activeView} />);

    expect(
      screen.getByRole("button", { name: `노트 보기: ${label}` }),
    ).toBeInTheDocument();
  });

  it("모바일에서는 짧은 보기 메뉴와 검색창을 제목 행 그리드에 배치한다", () => {
    render(<NotesToolbar initialQuery="" activeView="all" />);

    const viewButton = screen.getByRole("button", { name: "노트 보기: 전체" });
    const searchInput = screen.getByPlaceholderText("제목 또는 내용 검색");
    const searchContainer = searchInput.parentElement;
    const toolbar = searchContainer?.parentElement;

    expect(toolbar).toHaveClass("contents", "sm:flex");
    expect(viewButton).toHaveClass(
      "justify-self-end",
      "justify-between",
      "rounded-md",
      "w-36",
      "data-[state=open]:rounded-b-none",
      "data-[state=open]:border-b-transparent",
      "sm:justify-self-auto",
    );
    expect(viewButton).not.toHaveClass("w-full");
    expect(searchContainer).toHaveClass(
      "col-span-2",
      "w-full",
      "sm:col-auto",
      "sm:w-auto",
    );
  });

  it("검색어 입력은 debounce 후 한 번만 이동한다", () => {
    render(<NotesToolbar initialQuery="" activeView="all" />);
    const input = screen.getByPlaceholderText("제목 또는 내용 검색");

    fireEvent.change(input, { target: { value: "테" } });
    fireEvent.change(input, { target: { value: "테스트" } });

    expect(pushMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith(
      "/notes?q=%ED%85%8C%EC%8A%A4%ED%8A%B8",
    );
  });

  it("검색어를 지우면 대기 중인 debounce를 취소하고 즉시 이동한다", () => {
    // useSearchParams가 비어 있으면 동기화 effect가 initialQuery를 덮으므로 입력으로 채운다.
    render(<NotesToolbar initialQuery="" activeView="all" />);
    fireEvent.change(screen.getByPlaceholderText("제목 또는 내용 검색"), {
      target: { value: "테스트" },
    });

    fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));

    expect(pushMock).toHaveBeenCalledWith("/notes");

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it("검색어를 지운 뒤에도 URL 변경을 검색창에 다시 반영한다", () => {
    const { rerender } = render(
      <NotesToolbar initialQuery="" activeView="all" />,
    );
    const input = screen.getByPlaceholderText("제목 또는 내용 검색");

    // debounce가 끝나기 전에 지우면 타이머 안의 isTypingRef 해제가 실행되지 않는다.
    fireEvent.change(input, { target: { value: "테스트" } });
    fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));

    // 뒤로가기 등으로 q가 다시 붙은 URL로 돌아온 상황.
    currentSearchParams = new URLSearchParams("q=테스트");
    rerender(<NotesToolbar initialQuery="테스트" activeView="all" />);

    expect(input).toHaveValue("테스트");
  });
});
