import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useBeforeUnloadGuard } from "../useBeforeUnloadGuard";

describe("useBeforeUnloadGuard", () => {
  it("비활성 상태에서는 beforeunload를 막지 않는다", () => {
    renderHook(() =>
      useBeforeUnloadGuard({
        enabled: false,
      }),
    );

    const event = new Event("beforeunload", {
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("활성 상태에서는 beforeunload를 막는다", () => {
    renderHook(() =>
      useBeforeUnloadGuard({
        enabled: true,
      }),
    );

    const event = new Event("beforeunload", {
      cancelable: true,
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("unmount 시 beforeunload listener를 제거한다", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() =>
      useBeforeUnloadGuard({
        enabled: true,
      }),
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );

    removeEventListenerSpy.mockRestore();
  });

  it("활성 상태에서 비활성 상태로 변경하면 listener를 제거한다", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { rerender } = renderHook(
      ({ enabled }) =>
        useBeforeUnloadGuard({
          enabled,
        }),
      {
        initialProps: {
          enabled: true,
        },
      },
    );

    rerender({
      enabled: false,
    });

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );

    removeEventListenerSpy.mockRestore();
  });
});
