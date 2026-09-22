import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInternalNavigationGuard } from "../useInternalNavigationGuard";

const NAVIGATION_GUARD_HISTORY_INDEX_KEY =
  "__woodpeckerNavigationGuardHistoryIndex";
const NAVIGATION_GUARD_MOUNT_ID_KEY = "__woodpeckerNavigationGuardMountId";

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

async function dispatchPopState(state: unknown) {
  await act(async () => {
    window.dispatchEvent(
      new PopStateEvent("popstate", {
        state,
      }),
    );

    await Promise.resolve();
  });
}

/**
 * 현재 마운트된 guard가 기록한 것과 같은 마운트 식별자를 가진
 * History state를 만듭니다. Hook 설치 이후에 호출해야 합니다.
 */
function createHistoryState(index: number) {
  return {
    [NAVIGATION_GUARD_HISTORY_INDEX_KEY]: index,
    [NAVIGATION_GUARD_MOUNT_ID_KEY]:
      window.history.state[NAVIGATION_GUARD_MOUNT_ID_KEY],
  };
}

describe("useInternalNavigationGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/note-chats/test");
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    window.history.replaceState({}, "", "/");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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

  it("같은 페이지의 hash 링크는 활성 상태에서도 이동을 보류하지 않는다", async () => {
    const { result } = renderHook(() =>
      useInternalNavigationGuard({
        enabled: true,
      }),
    );

    const link = document.createElement("a");
    link.href = "#section";

    document.body.appendChild(link);

    await dispatchLinkClick(link);

    expect(result.current.isNavigationPending).toBe(false);
  });

  it("hash 링크 이동 이후의 실제 내부 페이지 이동은 정상적으로 보류한다", async () => {
    const { result } = renderHook(() =>
      useInternalNavigationGuard({
        enabled: true,
      }),
    );

    const hashLink = document.createElement("a");
    hashLink.href = "#section";

    document.body.appendChild(hashLink);

    await dispatchLinkClick(hashLink);

    expect(result.current.isNavigationPending).toBe(false);

    /*
     * hash-only 이동이 navigation guard의 허용 플래그를 남기지 않아야 합니다.
     *
     * 이후 실제 페이지 이동은 기존 정책대로 다시 보류되어야 합니다.
     * 이번 회귀 문제를 직접 검증하는 테스트입니다.
     */
    const pageLink = document.createElement("a");
    pageLink.href = "/notes";

    document.body.appendChild(pageLink);

    await dispatchLinkClick(pageLink);

    expect(result.current.isNavigationPending).toBe(true);
    expect(window.location.pathname).toBe("/note-chats/test");
  });

  it("같은 페이지에서 hash만 다른 pushState는 이동을 보류하지 않는다", () => {
    const { result } = renderHook(() =>
      useInternalNavigationGuard({
        enabled: true,
      }),
    );

    act(() => {
      window.history.pushState({}, "", "/note-chats/test#section");
    });

    expect(result.current.isNavigationPending).toBe(false);
    expect(window.location.pathname).toBe("/note-chats/test");
    expect(window.location.hash).toBe("#section");
  });

  it("같은 페이지에서 hash만 다른 replaceState는 이동을 보류하지 않는다", () => {
    const { result } = renderHook(() =>
      useInternalNavigationGuard({
        enabled: true,
      }),
    );

    act(() => {
      window.history.replaceState({}, "", "/note-chats/test#section");
    });

    expect(result.current.isNavigationPending).toBe(false);
    expect(window.location.pathname).toBe("/note-chats/test");
    expect(window.location.hash).toBe("#section");
  });

  it("query string이 변경되는 pushState는 hash 이동과 달리 보류한다", async () => {
    const { result } = renderHook(() =>
      useInternalNavigationGuard({
        enabled: true,
      }),
    );

    act(() => {
      window.history.pushState({}, "", "/note-chats/test?tab=history");
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.isNavigationPending).toBe(true);
    expect(window.location.pathname).toBe("/note-chats/test");
    expect(window.location.search).toBe("");
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

  it("활성 상태가 해제되어도 이미 보류 중인 이동은 유지한다", async () => {
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

    expect(result.current.isNavigationPending).toBe(true);
    expect(window.location.pathname).toBe("/note-chats/test");

    act(() => {
      result.current.cancelNavigation();
    });

    expect(result.current.isNavigationPending).toBe(false);
  });

  it("활성 상태가 해제된 뒤의 새로운 내부 링크 이동은 보류하지 않는다", async () => {
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

    act(() => {
      rerender({
        enabled: false,
      });
    });

    const link = document.createElement("a");
    link.href = "/notes";

    document.body.appendChild(link);

    await dispatchLinkClick(link);

    expect(result.current.isNavigationPending).toBe(false);
  });

  it("활성 상태가 해제되어도 이미 보류된 이동을 확인하면 원래 이동을 실행한다", async () => {
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

    const clickSpy = vi.spyOn(link, "click").mockImplementation(() => {});

    act(() => {
      rerender({
        enabled: false,
      });
    });

    expect(result.current.isNavigationPending).toBe(true);

    act(() => {
      result.current.confirmNavigation();
    });

    expect(result.current.isNavigationPending).toBe(false);
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it("뒤로가기를 감지하면 원래 History 위치로 복귀한 뒤 이동 확인을 보류하고 취소할 수 있다", async () => {
    /*
     * Hook 설치 전에 원본 replaceState를 보관합니다.
     *
     * jsdom에서는 history.go()가 실제 브라우저처럼 popstate를
     * 연속해서 발생시키지 않으므로 History 위치 변화는 테스트에서
     * 직접 재현합니다.
     */
    const originalReplaceState = window.history.replaceState;

    const historyGoSpy = vi
      .spyOn(window.history, "go")
      .mockImplementation(() => {});

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useInternalNavigationGuard({
          enabled,
        }),
      {
        initialProps: {
          enabled: false,
        },
      },
    );

    /*
     * 현재 entry(index 0)에서 새 entry(index 1)로 이동합니다.
     * guard가 비활성 상태이므로 pushState는 즉시 수행됩니다.
     */
    act(() => {
      window.history.pushState({}, "", "/notes");
    });

    const currentState = window.history.state;

    expect(currentState[NAVIGATION_GUARD_HISTORY_INDEX_KEY]).toBe(1);

    act(() => {
      rerender({
        enabled: true,
      });
    });

    /*
     * 사용자가 뒤로가기를 눌러 index 0 entry에 도착한 상황을
     * jsdom에서 직접 재현합니다.
     */
    const targetState = createHistoryState(0);

    originalReplaceState.call(
      window.history,
      targetState,
      "",
      "/note-chats/test",
    );

    await dispatchPopState(targetState);

    /*
     * 뒤로가기 delta는 -1이므로 원래 index 1 위치로 복귀하기 위해
     * history.go(1)을 요청해야 합니다.
     */
    expect(historyGoSpy).toHaveBeenCalledWith(1);
    expect(result.current.isNavigationPending).toBe(false);

    /*
     * 원래 index 1 entry로 복귀하면서 발생하는 두 번째 popstate를
     * 재현합니다.
     */
    originalReplaceState.call(window.history, currentState, "", "/notes");

    await dispatchPopState(currentState);

    expect(result.current.isNavigationPending).toBe(true);
    expect(window.location.pathname).toBe("/notes");

    act(() => {
      result.current.cancelNavigation();
    });

    expect(result.current.isNavigationPending).toBe(false);

    /*
     * 취소했으므로 최초에 요청했던 뒤로가기를 다시 실행하지 않습니다.
     */
    expect(historyGoSpy).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/notes");
  });

  it("다른 마운트가 남긴 index와 같은 index의 entry로 뒤로가기해도 이동을 보류한다", async () => {
    const originalReplaceState = window.history.replaceState;

    const historyGoSpy = vi
      .spyOn(window.history, "go")
      .mockImplementation(() => {});

    /*
     * 이전 페이지의 guard가 자기 entry에 index 0을 남기고 언마운트된 상황입니다.
     * 그 뒤 새 페이지로 이동해 guard가 다시 마운트되면 이 entry도 index 0에서
     * 시작하므로, 마운트 식별자가 없으면 두 entry를 같은 위치로 오판합니다.
     */
    const previousPageState = {
      [NAVIGATION_GUARD_HISTORY_INDEX_KEY]: 0,
      [NAVIGATION_GUARD_MOUNT_ID_KEY]: "previous-mount",
    };

    originalReplaceState.call(window.history, {}, "", "/notes/new");

    const { result } = renderHook(() =>
      useInternalNavigationGuard({
        enabled: true,
      }),
    );

    const currentState = window.history.state;

    expect(currentState[NAVIGATION_GUARD_HISTORY_INDEX_KEY]).toBe(0);
    expect(currentState[NAVIGATION_GUARD_MOUNT_ID_KEY]).not.toBe(
      "previous-mount",
    );

    originalReplaceState.call(
      window.history,
      previousPageState,
      "",
      "/notes/test",
    );

    await dispatchPopState(previousPageState);

    /*
     * 다른 마운트의 index는 무시하고 뒤로가기 1회로 취급해 복귀를 요청합니다.
     */
    expect(historyGoSpy).toHaveBeenCalledWith(1);
    expect(result.current.isNavigationPending).toBe(false);

    originalReplaceState.call(window.history, currentState, "", "/notes/new");

    await dispatchPopState(currentState);

    expect(result.current.isNavigationPending).toBe(true);
    expect(window.location.pathname).toBe("/notes/new");
  });

  it("앞으로가기를 확인하면 원래 목표 History 위치로 다시 이동하고 해당 popstate를 다시 보류하지 않는다", async () => {
    const originalReplaceState = window.history.replaceState;

    const historyGoSpy = vi
      .spyOn(window.history, "go")
      .mockImplementation(() => {});

    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useInternalNavigationGuard({
          enabled,
        }),
      {
        initialProps: {
          enabled: false,
        },
      },
    );

    /*
     * index 0 -> index 1 -> index 2 History를 준비합니다.
     */
    act(() => {
      window.history.pushState({}, "", "/notes");
      window.history.pushState({}, "", "/mypage");
    });

    const forwardTargetState = window.history.state;

    expect(forwardTargetState[NAVIGATION_GUARD_HISTORY_INDEX_KEY]).toBe(2);

    /*
     * 현재 위치를 index 1로 옮긴 뒤 popstate를 전달해
     * Hook 내부 currentHistoryIndex도 1로 동기화합니다.
     *
     * 아직 guard가 비활성 상태이므로 그대로 허용됩니다.
     */
    const currentState = createHistoryState(1);

    originalReplaceState.call(window.history, currentState, "", "/notes");

    await dispatchPopState(currentState);

    act(() => {
      rerender({
        enabled: true,
      });
    });

    /*
     * 사용자가 앞으로가기를 눌러 index 2에 도착한 상황입니다.
     */
    originalReplaceState.call(
      window.history,
      forwardTargetState,
      "",
      "/mypage",
    );

    await dispatchPopState(forwardTargetState);

    /*
     * 앞으로가기 delta는 +1이므로 사용자 확인 전에
     * 원래 index 1 위치로 돌아가기 위해 history.go(-1)을 요청합니다.
     */
    expect(historyGoSpy).toHaveBeenCalledWith(-1);
    expect(result.current.isNavigationPending).toBe(false);

    /*
     * index 1로 복귀하면서 발생하는 popstate를 재현합니다.
     */
    originalReplaceState.call(window.history, currentState, "", "/notes");

    await dispatchPopState(currentState);

    expect(result.current.isNavigationPending).toBe(true);
    expect(window.location.pathname).toBe("/notes");

    act(() => {
      result.current.confirmNavigation();
    });

    expect(result.current.isNavigationPending).toBe(false);

    /*
     * 사용자가 이동을 확인했으므로 최초 요청했던 앞으로가기를
     * history.go(1)로 다시 실행합니다.
     */
    expect(historyGoSpy).toHaveBeenLastCalledWith(1);
    expect(historyGoSpy).toHaveBeenCalledTimes(2);

    /*
     * 확인 후 목표 index 2에 실제로 도착하면서 발생한 popstate는
     * 이미 허용된 이동이므로 다시 navigation guard를 열지 않습니다.
     */
    originalReplaceState.call(
      window.history,
      forwardTargetState,
      "",
      "/mypage",
    );

    await dispatchPopState(forwardTargetState);

    expect(result.current.isNavigationPending).toBe(false);
    expect(window.location.pathname).toBe("/mypage");
    expect(window.history.state[NAVIGATION_GUARD_HISTORY_INDEX_KEY]).toBe(2);

    expect(historyGoSpy).toHaveBeenCalledTimes(2);
  });

  it.each([
    { label: "기록 없는 앞으로가기", state: {}, delta: 1 },
    { label: "기록 없는 두 칸 앞으로가기", state: {}, delta: 2 },
    { label: "기록 없는 두 칸 뒤로가기", state: {}, delta: -2 },
    {
      label: "다른 마운트의 앞으로가기",
      state: {
        [NAVIGATION_GUARD_HISTORY_INDEX_KEY]: 0,
        [NAVIGATION_GUARD_MOUNT_ID_KEY]: "another-mount",
      },
      delta: 1,
    },
  ])(
    "$label 후 취소하면 원래 entry를 유지하고 확인하면 목표로 이동한다",
    async ({ state, delta }) => {
      const navigation = { currentEntry: { index: 10 } };
      vi.stubGlobal("navigation", navigation);
      const originalReplaceState = window.history.replaceState;
      const historyGoSpy = vi
        .spyOn(window.history, "go")
        .mockImplementation(() => {});
      const { result } = renderHook(() =>
        useInternalNavigationGuard({ enabled: true }),
      );
      const currentState = window.history.state;
      const routerPopState = vi.fn();
      window.addEventListener("popstate", routerPopState);

      try {
        for (const decision of ["cancel", "confirm"] as const) {
          navigation.currentEntry.index = 10 + delta;
          originalReplaceState.call(window.history, state, "", "/notes/target");
          await dispatchPopState(state);

          expect(historyGoSpy).toHaveBeenLastCalledWith(-delta);
          expect(result.current.isNavigationPending).toBe(false);
          expect(routerPopState).not.toHaveBeenCalled();

          navigation.currentEntry.index = 10;
          originalReplaceState.call(
            window.history,
            currentState,
            "",
            "/note-chats/test",
          );
          await dispatchPopState(currentState);
          expect(result.current.isNavigationPending).toBe(true);
          expect(routerPopState).not.toHaveBeenCalled();

          const callCount = historyGoSpy.mock.calls.length;
          act(() => {
            if (decision === "cancel") result.current.cancelNavigation();
            else result.current.confirmNavigation();
          });
          expect(result.current.isNavigationPending).toBe(false);

          if (decision === "cancel") {
            expect(historyGoSpy).toHaveBeenCalledTimes(callCount);
            expect(window.location.pathname).toBe("/note-chats/test");
          } else {
            expect(historyGoSpy).toHaveBeenLastCalledWith(delta);
            navigation.currentEntry.index = 10 + delta;
            originalReplaceState.call(
              window.history,
              state,
              "",
              "/notes/target",
            );
            await dispatchPopState(state);
            expect(result.current.isNavigationPending).toBe(false);
            expect(routerPopState).toHaveBeenCalledOnce();
            expect(window.location.pathname).toBe("/notes/target");
          }
        }
      } finally {
        window.removeEventListener("popstate", routerPopState);
      }
    },
  );

  it.each([
    "pushState",
    "replaceState",
    "hash popstate",
    "disabled popstate",
  ] as const)("%s 이후 실제 History 위치를 동기화한다", async (method) => {
    const navigation = { currentEntry: { index: 10 } };
    vi.stubGlobal("navigation", navigation);
    const originalReplaceState = window.history.replaceState;
    const historyGoSpy = vi
      .spyOn(window.history, "go")
      .mockImplementation(() => {});
    const { rerender } = renderHook(
      ({ enabled }) => useInternalNavigationGuard({ enabled }),
      { initialProps: { enabled: method !== "disabled popstate" } },
    );

    // replaceState는 entry를 추가하지 않는다. 나머지는 한 칸 이동한다.
    const currentIndex = method === "replaceState" ? 10 : 11;
    navigation.currentEntry.index = currentIndex;
    if (method === "pushState" || method === "replaceState") {
      act(() => window.history[method]({}, "", "/note-chats/test#section"));
    } else {
      originalReplaceState.call(
        window.history,
        {},
        "",
        "/note-chats/test#section",
      );
      await dispatchPopState({});
    }
    rerender({ enabled: true });

    navigation.currentEntry.index = currentIndex + 1;
    originalReplaceState.call(window.history, {}, "", "/notes/target");
    await dispatchPopState({});
    expect(historyGoSpy).toHaveBeenCalledExactlyOnceWith(-1);
  });

  it("같은 페이지의 hash History를 popstate로 이동하면 보류하지 않는다", async () => {
    const originalReplaceState = window.history.replaceState;

    const { result } = renderHook(() =>
      useInternalNavigationGuard({
        enabled: true,
      }),
    );

    const hashState = createHistoryState(1);

    originalReplaceState.call(
      window.history,
      hashState,
      "",
      "/note-chats/test#section",
    );

    await dispatchPopState(hashState);

    expect(result.current.isNavigationPending).toBe(false);
    expect(window.location.pathname).toBe("/note-chats/test");
    expect(window.location.hash).toBe("#section");
  });
});
