// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNoteChatDialogVisualViewport } from "../use-note-chat-dialog-visual-viewport";

type MockVisualViewport = EventTarget & {
  height: number;
  offsetTop: number;
};

let visualViewport: MockVisualViewport;

let nextAnimationFrameId = 1;
let animationFrameCallbacks = new Map<number, FrameRequestCallback>();

const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
  const id = nextAnimationFrameId++;

  animationFrameCallbacks.set(id, callback);

  return id;
});

const cancelAnimationFrameMock = vi.fn((id: number) => {
  animationFrameCallbacks.delete(id);
});

function flushAnimationFrames() {
  const callbacks = [...animationFrameCallbacks.entries()];

  animationFrameCallbacks.clear();

  callbacks.forEach(([id, callback]) => {
    callback(id);
  });
}

function setCoarsePointer(matches: boolean) {
  window.matchMedia = vi.fn(() => ({
    matches,
  })) as unknown as typeof window.matchMedia;
}

function setVisualViewport({
  height,
  offsetTop,
}: {
  height: number;
  offsetTop: number;
}) {
  visualViewport = new EventTarget() as MockVisualViewport;
  visualViewport.height = height;
  visualViewport.offsetTop = offsetTop;

  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: visualViewport,
  });
}

describe("useNoteChatDialogVisualViewport", () => {
  beforeEach(() => {
    nextAnimationFrameId = 1;
    animationFrameCallbacks = new Map();

    requestAnimationFrameMock.mockClear();
    cancelAnimationFrameMock.mockClear();

    vi.stubGlobal("requestAnimationFrame", requestAnimationFrameMock);
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrameMock);

    setCoarsePointer(false);

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("Dialog가 닫혀 있으면 viewport 스타일을 반환하지 않는다", () => {
    setCoarsePointer(true);
    setVisualViewport({
      height: 500,
      offsetTop: 20,
    });

    const { result } = renderHook(() => useNoteChatDialogVisualViewport(false));

    expect(result.current).toBeNull();
    expect(requestAnimationFrameMock).not.toHaveBeenCalled();
  });

  it("coarse pointer 환경이 아니면 viewport 스타일을 적용하지 않는다", () => {
    setCoarsePointer(false);
    setVisualViewport({
      height: 500,
      offsetTop: 20,
    });

    const { result } = renderHook(() => useNoteChatDialogVisualViewport(true));

    expect(result.current).toBeNull();
    expect(requestAnimationFrameMock).not.toHaveBeenCalled();
  });

  it("Visual Viewport API를 지원하지 않으면 viewport 스타일을 적용하지 않는다", () => {
    setCoarsePointer(true);

    const { result } = renderHook(() => useNoteChatDialogVisualViewport(true));

    expect(result.current).toBeNull();
    expect(requestAnimationFrameMock).not.toHaveBeenCalled();
  });

  it("coarse pointer 환경에서는 visual viewport 기준 위치와 최대 높이를 계산한다", () => {
    setCoarsePointer(true);
    setVisualViewport({
      height: 500,
      offsetTop: 20,
    });

    const { result } = renderHook(() => useNoteChatDialogVisualViewport(true));

    expect(result.current).toBeNull();

    act(() => {
      flushAnimationFrames();
    });

    expect(result.current).toEqual({
      top: 270,
      maxHeight: 468,
    });
  });

  it("visual viewport가 resize되면 Dialog 위치와 최대 높이를 다시 계산한다", () => {
    setCoarsePointer(true);
    setVisualViewport({
      height: 500,
      offsetTop: 20,
    });

    const { result } = renderHook(() => useNoteChatDialogVisualViewport(true));

    act(() => {
      flushAnimationFrames();
    });

    visualViewport.height = 320;
    visualViewport.offsetTop = 10;

    act(() => {
      visualViewport.dispatchEvent(new Event("resize"));
      flushAnimationFrames();
    });

    expect(result.current).toEqual({
      top: 170,
      maxHeight: 288,
    });
  });

  it("visual viewport가 scroll되면 Dialog 위치를 다시 계산한다", () => {
    setCoarsePointer(true);
    setVisualViewport({
      height: 400,
      offsetTop: 0,
    });

    const { result } = renderHook(() => useNoteChatDialogVisualViewport(true));

    act(() => {
      flushAnimationFrames();
    });

    visualViewport.offsetTop = 40;

    act(() => {
      visualViewport.dispatchEvent(new Event("scroll"));
      flushAnimationFrames();
    });

    expect(result.current).toEqual({
      top: 240,
      maxHeight: 368,
    });
  });

  it("Dialog가 닫히면 기존 viewport 스타일을 초기화한다", () => {
    setCoarsePointer(true);
    setVisualViewport({
      height: 500,
      offsetTop: 20,
    });

    const { result, rerender } = renderHook(
      ({ open }) => useNoteChatDialogVisualViewport(open),
      {
        initialProps: {
          open: true,
        },
      },
    );

    act(() => {
      flushAnimationFrames();
    });

    expect(result.current).toEqual({
      top: 270,
      maxHeight: 468,
    });

    rerender({
      open: false,
    });

    expect(result.current).toBeNull();
  });

  it("unmount 시 등록한 viewport 이벤트와 대기 중인 animation frame을 정리한다", () => {
    setCoarsePointer(true);
    setVisualViewport({
      height: 500,
      offsetTop: 20,
    });

    const removeEventListenerSpy = vi.spyOn(
      visualViewport,
      "removeEventListener",
    );

    const { unmount } = renderHook(() => useNoteChatDialogVisualViewport(true));

    expect(requestAnimationFrameMock).toHaveBeenCalledOnce();

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "resize",
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "scroll",
      expect.any(Function),
    );
    expect(cancelAnimationFrameMock).toHaveBeenCalledOnce();
  });
});
