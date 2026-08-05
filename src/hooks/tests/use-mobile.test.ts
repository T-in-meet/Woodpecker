import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useIsMobile } from "../use-mobile";

function setViewportWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
}

describe("useIsMobile", () => {
  afterEach(() => {
    setViewportWidth(1024);
  });

  it("초기 마운트 시 현재 viewport가 768px 미만이면 mobile로 판단한다", async () => {
    setViewportWidth(767);

    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("resize 이벤트가 발생하면 mobile 여부를 갱신한다", async () => {
    setViewportWidth(1024);
    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);

    act(() => {
      setViewportWidth(500);
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    act(() => {
      setViewportWidth(768);
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });
});
