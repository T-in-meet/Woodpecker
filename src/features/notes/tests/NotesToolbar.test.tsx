import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotesToolbar } from "../components/NotesToolbar";
import { buildNotesUrl } from "../utils/buildNotesUrl";

const replaceMock = vi.fn();
let currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => currentSearchParams,
}));
const input = () => screen.getByRole("searchbox", { name: "노트 검색" });
const type = (value: string) =>
  fireEvent.change(input(), { target: { value } });
const flush = () => act(() => vi.advanceTimersByTime(350));

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
    ["completed", "학습 종료"],
  ] as const)("%s 필터를 항상 노출하고 현재 상태를 표시한다", (view, label) => {
    render(<NotesToolbar initialQuery="" activeView={view} />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("link", { name: label })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("필터 링크는 검색어를 유지하고 페이지를 초기화한다", () => {
    currentSearchParams = new URLSearchParams("q=기억&page=3");
    render(<NotesToolbar initialQuery="기억" activeView="all" />);
    expect(screen.getByRole("link", { name: "오늘 복습" })).toHaveAttribute(
      "href",
      buildNotesUrl({ query: "기억", view: "due" }),
    );
  });

  it("연속 입력은 마지막 값으로 기록을 교체하고 스크롤을 유지한다", () => {
    render(<NotesToolbar initialQuery="" activeView="all" />);
    type("테");
    type("테스트");
    expect(replaceMock).not.toHaveBeenCalled();
    flush();
    expect(replaceMock).toHaveBeenCalledExactlyOnceWith(
      buildNotesUrl({ query: "테스트" }),
      { scroll: false },
    );
  });

  it.each(["Enter", "button"])(
    "%s 확정은 즉시 검색하고 debounce 및 동일 검색을 중복 실행하지 않는다",
    (method) => {
      render(<NotesToolbar initialQuery="" activeView="all" />);
      type("테스트");
      if (method === "Enter") fireEvent.keyDown(input(), { key: "Enter" });
      else fireEvent.click(screen.getByRole("button", { name: "검색" }));
      expect(replaceMock).toHaveBeenCalledTimes(1);
      flush();
      fireEvent.keyDown(input(), { key: "Enter" });
      expect(replaceMock).toHaveBeenCalledTimes(1);
    },
  );

  it("동일 URL로 검색을 확정하면 이동하지 않는다", () => {
    currentSearchParams = new URLSearchParams("q=기억");
    render(<NotesToolbar initialQuery="기억" activeView="all" />);
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("검색어를 지우면 필터를 유지하고 페이지 및 대기 검색을 초기화한다", () => {
    currentSearchParams = new URLSearchParams("q=기억&view=due&page=3");
    render(<NotesToolbar initialQuery="기억" activeView="due" />);
    type("새 검색");
    fireEvent.click(screen.getByRole("button", { name: "검색어 지우기" }));
    flush();
    expect(input()).toHaveValue("");
    expect(replaceMock).toHaveBeenCalledExactlyOnceWith(
      buildNotesUrl({ view: "due" }),
      { scroll: false },
    );
  });

  it("한글 조합 중 타이머와 Enter 제출을 보류하고 완료 후 검색한다", () => {
    render(<NotesToolbar initialQuery="" activeView="all" />);
    type("ㄱ");
    fireEvent.compositionStart(input());
    type("기억");
    fireEvent.keyDown(input(), { key: "Enter", isComposing: true });
    fireEvent.submit(screen.getByRole("search"));
    flush();
    expect(replaceMock).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input(), { data: "기억" });
    flush();
    expect(replaceMock).toHaveBeenCalledExactlyOnceWith(
      buildNotesUrl({ query: "기억" }),
      { scroll: false },
    );
  });

  it("필터 이동은 최신 입력을 보존하고 이전 debounce를 취소한다", () => {
    const { rerender } = render(
      <NotesToolbar initialQuery="" activeView="all" />,
    );
    type("기억");
    const link = screen.getByRole("link", { name: "오늘 복습" });
    expect(link).toHaveAttribute(
      "href",
      buildNotesUrl({ query: "기억", view: "due" }),
    );
    // Prevent jsdom navigation after the component and document handlers ran.
    const prevent = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("click", prevent);
    fireEvent.click(link);
    document.removeEventListener("click", prevent);
    flush();
    expect(replaceMock).not.toHaveBeenCalled();
    currentSearchParams = new URLSearchParams("q=기억&view=due");
    rerender(<NotesToolbar initialQuery="기억" activeView="due" />);
    expect(input()).toHaveValue("기억");
  });

  it("뒤로가기 직후 URL 반영 전에도 대기 검색을 취소한다", () => {
    const { rerender } = render(
      <NotesToolbar initialQuery="" activeView="all" />,
    );
    type("새 검색");
    act(() => window.dispatchEvent(new PopStateEvent("popstate")));
    flush();
    expect(replaceMock).not.toHaveBeenCalled();
    currentSearchParams = new URLSearchParams("q=이전");
    rerender(<NotesToolbar initialQuery="이전" activeView="all" />);
    expect(input()).toHaveValue("이전");
  });

  it("다른 URL을 받거나 unmount되면 대기 검색을 폐기한다", () => {
    const { rerender, unmount } = render(
      <NotesToolbar initialQuery="" activeView="all" />,
    );
    type("새 검색");
    currentSearchParams = new URLSearchParams("q=이전");
    rerender(<NotesToolbar initialQuery="이전" activeView="all" />);
    flush();
    expect(input()).toHaveValue("이전");
    expect(replaceMock).not.toHaveBeenCalled();
    type("다른 검색");
    unmount();
    flush();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

it("느린 이전 검색 응답은 더 최근 입력과 대기 검색을 덮어쓰지 않는다", () => {
  vi.useFakeTimers();
  replaceMock.mockClear();
  currentSearchParams = new URLSearchParams();
  const { rerender, unmount } = render(
    <NotesToolbar initialQuery="" activeView="all" />,
  );
  type("기억");
  flush();
  type("기억력");
  currentSearchParams = new URLSearchParams("q=기억");
  rerender(<NotesToolbar initialQuery="기억" activeView="all" />);
  expect(input()).toHaveValue("기억력");
  flush();
  expect(replaceMock).toHaveBeenLastCalledWith(
    buildNotesUrl({ query: "기억력" }),
    { scroll: false },
  );
  unmount();
  vi.useRealTimers();
});
