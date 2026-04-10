import "@/tests/setup";

import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { usePreventPageLeave } from "../usePreventPageLeave";

const CONFIRM_MESSAGE =
  "페이지를 떠나시겠습니까? 작성 중인 내용이 저장되지 않습니다.";

describe("usePreventPageLeave", () => {
  let originalPushState: typeof history.pushState;
  let originalReplaceState: typeof history.replaceState;

  beforeEach(() => {
    originalPushState = history.pushState;
    originalReplaceState = history.replaceState;
    originalReplaceState.call(history, null, "", "/current");
  });

  afterEach(() => {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    originalReplaceState.call(history, null, "", "/current");
    vi.restoreAllMocks();
  });

  it("shouldPrevent가 true일 때 beforeunload 이벤트를 가로챈다", () => {
    renderHook(() => usePreventPageLeave(true));

    const event = new Event("beforeunload", {
      cancelable: true,
    }) as BeforeUnloadEvent;
    Object.defineProperty(event, "returnValue", {
      configurable: true,
      value: undefined,
      writable: true,
    });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(event.returnValue).toBe("");
  });

  it("shouldPrevent가 false일 때 beforeunload 이벤트를 가로채지 않는다", () => {
    renderHook(() => usePreventPageLeave(false));

    const event = new Event("beforeunload") as BeforeUnloadEvent;
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it("pushState 이동을 취소하면 현재 URL을 유지한다", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderHook(() => usePreventPageLeave(true));

    history.pushState(null, "", "/other");

    expect(confirmSpy).toHaveBeenCalledWith(CONFIRM_MESSAGE);
    expect(window.location.pathname).toBe("/current");
  });

  it("pushState 이동을 확인하면 다음 URL로 이동한다", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderHook(() => usePreventPageLeave(true));

    history.pushState({ next: true }, "", "/other");

    expect(window.location.pathname).toBe("/other");
    expect(history.state).toEqual({ next: true });
  });

  it("replaceState 이동도 이탈 확인을 거친다", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    renderHook(() => usePreventPageLeave(true));

    history.replaceState(null, "", "/other");

    expect(confirmSpy).toHaveBeenCalledWith(CONFIRM_MESSAGE);
    expect(window.location.pathname).toBe("/current");
  });

  it("뒤로가기를 취소하면 이전 URL로 넘어가지 않는다", () => {
    const currentState = { current: true };
    const previousState = { previous: true };
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    originalReplaceState.call(history, currentState, "", "/current");

    renderHook(() => usePreventPageLeave(true));

    originalPushState.call(history, previousState, "", "/previous");
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: previousState }),
    );

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/current");
    expect(history.state).toEqual(currentState);
  });

  it("뒤로가기를 확인하면 이전 URL로 넘어간다", () => {
    const previousState = { previous: true };
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderHook(() => usePreventPageLeave(true));

    originalPushState.call(history, previousState, "", "/previous");
    window.dispatchEvent(
      new PopStateEvent("popstate", { state: previousState }),
    );

    expect(window.location.pathname).toBe("/previous");
    expect(history.state).toEqual(previousState);
  });

  it("shouldPrevent가 true에서 false로 변경되면 인터셉트를 해제한다", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    const { rerender } = renderHook(
      ({ shouldPrevent }) => usePreventPageLeave(shouldPrevent),
      { initialProps: { shouldPrevent: true } },
    );

    history.pushState(null, "", "/blocked");
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/current");

    rerender({ shouldPrevent: false });
    confirmSpy.mockClear();

    history.pushState(null, "", "/allowed");

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/allowed");
  });

  it("언마운트 시 history 인터셉트를 제거한다", () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    const { unmount } = renderHook(() => usePreventPageLeave(true));

    history.pushState(null, "", "/blocked");
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/current");

    unmount();
    confirmSpy.mockClear();

    history.pushState(null, "", "/allowed");

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/allowed");
  });
});
