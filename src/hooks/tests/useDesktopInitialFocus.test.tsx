import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useDesktopInitialFocus } from "../useDesktopInitialFocus";

afterEach(() => vi.unstubAllGlobals());
it.each([true, false])(
  "최초 미디어 조건이 %s이면 그 조건으로 한 번만 포커스한다",
  (matches) => {
    const media = vi.fn().mockReturnValue({ matches });
    vi.stubGlobal("matchMedia", media);
    const focus = vi.fn();
    const { result, rerender } = renderHook(() => useDesktopInitialFocus());
    expect(focus).not.toHaveBeenCalled();
    act(() => result.current(focus));
    expect(focus).toHaveBeenCalledTimes(matches ? 1 : 0);
    media.mockReturnValue({ matches: !matches });
    act(() => window.dispatchEvent(new Event("resize")));
    rerender();
    act(() => result.current(focus));
    expect(focus).toHaveBeenCalledTimes(matches ? 1 : 0);
    expect(media).toHaveBeenCalledExactlyOnceWith(
      "(min-width: 768px) and (pointer: fine)",
    );
  },
);
