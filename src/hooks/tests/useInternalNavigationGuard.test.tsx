import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInternalNavigationGuard } from "../useInternalNavigationGuard";

async function dispatchLinkClick(link: HTMLAnchorElement) {
  await act(async () => {
    link.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        button: 0,
      }),
    );

    await Promise.resolve();
  });
}

describe("useInternalNavigationGuard", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/note-chats/test");
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    window.history.replaceState({}, "", "/");
    vi.restoreAllMocks();
  });

  it("비활성 상태에서는 내부 링크 이동을 보류하지 않는다", async () => {
    const { result } = renderHook(() =>
      useInternalNavigationGuard({
        enabled: false,
      }),
    );

    const link = document.createElement("a");
    link.href = "/notes";

    document.body.appendChild(link);

    await dispatchLinkClick(link);

    expect(result.current.isNavigationPending).toBe(false);
  });

  it("활성 상태에서 내부 링크를 클릭하면 이동을 보류한다", async () => {
    const { result } = renderHook(() =>
      useInternalNavigationGuard({
        enabled: true,
      }),
    );

    const link = document.createElement("a");
    link.href = "/notes";

    document.body.appendChild(link);

    await dispatchLinkClick(link);

    expect(result.current.isNavigationPending).toBe(true);
    expect(window.location.pathname).toBe("/note-chats/test");
  });

  it("보류된 내부 링크 이동을 취소할 수 있다", async () => {
    const { result } = renderHook(() =>
      useInternalNavigationGuard({
        enabled: true,
      }),
    );

    const link = document.createElement("a");
    link.href = "/notes";

    document.body.appendChild(link);

    await dispatchLinkClick(link);

    expect(result.current.isNavigationPending).toBe(true);

    act(() => {
      result.current.cancelNavigation();
    });

    expect(result.current.isNavigationPending).toBe(false);
    expect(window.location.pathname).toBe("/note-chats/test");
  });

  it("보류된 내부 링크 이동을 확인하면 원래 링크 클릭을 다시 실행한다", async () => {
    const { result } = renderHook(() =>
      useInternalNavigationGuard({
        enabled: true,
      }),
    );

    const link = document.createElement("a");
    link.href = "/notes";

    document.body.appendChild(link);

    await dispatchLinkClick(link);

    expect(result.current.isNavigationPending).toBe(true);

    /*
     * jsdom은 실제 페이지 navigation을 구현하지 않으므로,
     * 이동 확인 시 원래 anchor 클릭을 다시 실행하는지만 검증합니다.
     */
    const clickSpy = vi.spyOn(link, "click").mockImplementation(() => {});

    act(() => {
      result.current.confirmNavigation();
    });

    expect(result.current.isNavigationPending).toBe(false);
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("새 탭으로 여는 내부 링크는 보류하지 않는다", async () => {
    const { result } = renderHook(() =>
      useInternalNavigationGuard({
        enabled: true,
      }),
    );

    const link = document.createElement("a");
    link.href = "/notes";
    link.target = "_blank";

    document.body.appendChild(link);

    await dispatchLinkClick(link);

    expect(result.current.isNavigationPending).toBe(false);
  });

  it("활성 상태가 해제되면 보류 중인 이동을 제거한다", async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useInternalNavigationGuard({
          enabled,
        }),
      {
        initialProps: {
          enabled: true,
        },
      },
    );

    const link = document.createElement("a");
    link.href = "/notes";

    document.body.appendChild(link);

    await dispatchLinkClick(link);

    expect(result.current.isNavigationPending).toBe(true);

    act(() => {
      rerender({
        enabled: false,
      });
    });

    expect(result.current.isNavigationPending).toBe(false);
    expect(window.location.pathname).toBe("/note-chats/test");
  });
});
