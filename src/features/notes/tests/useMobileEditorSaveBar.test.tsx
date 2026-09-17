import { act, render, screen } from "@testing-library/react";
import type { Editor } from "@tiptap/react";
import { useEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { useMobileEditorSaveBar } from "../hooks/useMobileEditorSaveBar";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setup(width: number) {
  vi.stubGlobal("innerWidth", width);
  vi.stubGlobal("innerHeight", 800);
  const viewport = Object.assign(new EventTarget(), {
    height: 800,
    offsetTop: 0,
    scale: 1,
  });
  vi.stubGlobal("visualViewport", viewport);
  const setOptions = vi.fn();
  const editor = {
    options: { editorProps: {} },
    isDestroyed: false,
    isFocused: false,
    setOptions,
    commands: { scrollIntoView: vi.fn() },
  } as unknown as Editor;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    height: 80,
  } as DOMRect);
  function Harness() {
    const { saveBarRef, onEditorReady } = useMobileEditorSaveBar();
    useEffect(() => onEditorReady(editor), [onEditorReady]);
    return <div ref={saveBarRef} data-testid="save-bar" />;
  }
  const result = render(<Harness />);
  return { ...result, viewport, setOptions };
}

it("키보드 높이가 바뀌어도 스크롤 여백은 저장바 높이만 확보한다", () => {
  const { viewport, setOptions, unmount } = setup(390);
  const bar = screen.getByTestId("save-bar");
  expect(bar.style.bottom).toBe("0px");
  expect(setOptions).toHaveBeenLastCalledWith({
    editorProps: {
      scrollMargin: { top: 96, right: 5, bottom: 96, left: 5 },
      scrollThreshold: { top: 96, right: 0, bottom: 96, left: 0 },
    },
  });
  // ProseMirror는 visualViewport.height를 사용하므로 키보드 높이는
  // 저장바 위치에만 적용하고 스크롤 여백에는 중복 반영하지 않는다.
  for (const height of [500, 400, 800]) {
    viewport.height = height;
    act(() => viewport.dispatchEvent(new Event("resize")));
    expect(bar.style.bottom).toBe(`${800 - height}px`);
    expect(setOptions).toHaveBeenLastCalledWith({
      editorProps: {
        scrollMargin: { top: 96, right: 5, bottom: 96, left: 5 },
        scrollThreshold: { top: 96, right: 0, bottom: 96, left: 0 },
      },
    });
  }
  unmount();
  setOptions.mockClear();
  act(() => viewport.dispatchEvent(new Event("resize")));
  expect(setOptions).not.toHaveBeenCalled();
});

it("핀치 확대를 키보드로 오인하지 않는다", () => {
  const { viewport } = setup(390);
  viewport.height = 400;
  viewport.scale = 2;
  act(() => viewport.dispatchEvent(new Event("resize")));
  expect(screen.getByTestId("save-bar").style.bottom).toBe("0px");
});

it("데스크톱 전환 시 모바일 위치와 에디터 스크롤 설정을 해제한다", () => {
  const { setOptions } = setup(390);
  vi.stubGlobal("innerWidth", 1024);
  act(() => window.dispatchEvent(new Event("resize")));
  expect(screen.getByTestId("save-bar").style.bottom).toBe("");
  expect(setOptions).toHaveBeenLastCalledWith({
    editorProps: { scrollMargin: 5, scrollThreshold: 0 },
  });
});
