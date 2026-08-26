import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotesToolbar } from "../components/NotesToolbar";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("NotesToolbar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["due", "오늘 복습할 노트"],
    ["scheduled", "복습 예정 노트"],
  ] as const)("%s 보기의 이름을 '%s'로 표시한다", (activeView, label) => {
    render(<NotesToolbar initialQuery="" activeView={activeView} />);

    expect(
      screen.getByRole("button", { name: new RegExp(label) }),
    ).toBeInTheDocument();
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
});
