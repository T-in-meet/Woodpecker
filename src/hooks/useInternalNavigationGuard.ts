"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const NAVIGATION_GUARD_HISTORY_INDEX_KEY =
  "__woodpeckerNavigationGuardHistoryIndex";

function resolveHistoryUrl(url?: string | URL | null) {
  if (url == null) {
    return window.location.href;
  }

  return new URL(url, window.location.href).href;
}

/**
 * History entry에 navigation guard가 사용할 index를 추가합니다.
 *
 * Next.js App Router가 저장한 기존 history state는 그대로 유지하고
 * guard 전용 값만 추가합니다.
 */
function withNavigationGuardHistoryIndex(state: unknown, index: number) {
  if (state !== null && typeof state === "object" && !Array.isArray(state)) {
    return {
      ...state,
      [NAVIGATION_GUARD_HISTORY_INDEX_KEY]: index,
    };
  }

  return {
    [NAVIGATION_GUARD_HISTORY_INDEX_KEY]: index,
  };
}

/**
 * History state에서 navigation guard가 기록한 index를 읽습니다.
 */
function getNavigationGuardHistoryIndex(state: unknown) {
  if (state === null || typeof state !== "object" || Array.isArray(state)) {
    return null;
  }

  const index = Reflect.get(state, NAVIGATION_GUARD_HISTORY_INDEX_KEY);

  return typeof index === "number" ? index : null;
}

type UseInternalNavigationGuardParams = {
  enabled: boolean;
};

type PendingPopStateRestore = {
  /**
   * 현재 History entry에서 사용자가 이동하려 한 entry까지의 상대 거리입니다.
   *
   * 음수이면 뒤로가기, 양수이면 앞으로가기입니다.
   */
  delta: number;

  /** 사용자가 이동하려 한 History entry의 guard index입니다. */
  targetIndex: number;
};

/**
 * 앱 내부 페이지 이동을 감지하고 사용자 확인 전까지 보류합니다.
 *
 * 실제 경고 UI는 이 Hook에서 다루지 않습니다.
 * 이동이 감지되면 isNavigationPending을 true로 만들고,
 * 호출부에서 confirmNavigation 또는 cancelNavigation을 호출해
 * 이동 여부를 결정합니다.
 *
 * enabled는 새로운 페이지 이동을 가로챌지 여부만 결정합니다.
 * 이미 이동을 보류해 AlertDialog가 열린 뒤에는 enabled가 false로
 * 변경되더라도 기존 보류 상태를 유지하며, 사용자가 직접 이동 또는
 * 취소를 선택해야 보류 상태가 종료됩니다.
 *
 * Next.js Link 클릭과 History API를 통한 프로그래밍 방식의 이동,
 * 브라우저 뒤로가기/앞으로가기를 처리합니다.
 *
 * popstate는 발생 시점에 이미 브라우저 History 위치가 변경된 상태이므로
 * 현재 entry로 먼저 복귀한 뒤 사용자 확인을 받고,
 * 확인된 경우 원래 요청한 History 위치로 다시 이동합니다.
 *
 * @param params Hook 입력값
 * @param params.enabled 새로운 이동을 경고 대상으로 처리할지 여부
 * @returns 보류 상태와 이동 확인/취소 액션
 */
export function useInternalNavigationGuard({
  enabled,
}: UseInternalNavigationGuardParams) {
  const [isNavigationPending, setIsNavigationPending] = useState(false);

  /*
   * enabled 변경 때문에 History listener 자체를 다시 등록하지 않습니다.
   *
   * 실행이 완료되어 enabled가 false가 되더라도 이미 보류 중인 navigation과
   * AlertDialog가 유지되어야 하므로 최신 enabled 값만 ref로 관리합니다.
   */
  const enabledRef = useRef(enabled);

  const pendingNavigationRef = useRef<(() => void) | null>(null);

  /*
   * 사용자가 AlertDialog에서 이동을 확인한 뒤
   * 동일한 Link 클릭이나 History 변경을 다시 실행할 때
   * guard가 다시 가로채지 않도록 사용합니다.
   */
  const allowNextLinkClickRef = useRef(false);
  const allowNextHistoryChangeRef = useRef(false);

  /*
   * 사용자가 확인한 뒤 실제 popstate 이동을 다시 실행할 때
   * 해당 popstate를 guard가 다시 가로채지 않도록 사용합니다.
   *
   * boolean 대신 목표 History index를 저장하여 이동 완료 후
   * 현재 History 위치도 정확히 동기화합니다.
   */
  const allowedPopStateTargetIndexRef = useRef<number | null>(null);

  /*
   * popstate는 발생 시점에 이미 History 위치가 이동한 상태입니다.
   *
   * 사용자 확인을 받기 전에 원래 entry로 복귀해야 하므로,
   * 최초 popstate에서 이동 방향과 목표 index를 저장한 뒤
   * 복귀 과정에서 발생하는 다음 popstate에서 Dialog를 엽니다.
   */
  const pendingPopStateRestoreRef = useRef<PendingPopStateRestore | null>(null);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const confirmNavigation = useCallback(() => {
    const pendingNavigation = pendingNavigationRef.current;

    pendingNavigationRef.current = null;
    setIsNavigationPending(false);

    pendingNavigation?.();
  }, []);

  const cancelNavigation = useCallback(() => {
    pendingNavigationRef.current = null;
    setIsNavigationPending(false);
  }, []);

  useEffect(() => {
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    /*
     * Hook이 설치된 시점의 현재 History entry를 기준점으로 사용합니다.
     *
     * 기존 Next.js history state를 유지한 채 guard 전용 index만 추가합니다.
     */
    let currentHistoryIndex =
      getNavigationGuardHistoryIndex(window.history.state) ?? 0;

    let currentUrl = window.location.href;

    const initialHistoryState = withNavigationGuardHistoryIndex(
      window.history.state,
      currentHistoryIndex,
    );

    originalReplaceState.call(
      window.history,
      initialHistoryState,
      "",
      currentUrl,
    );

    const syncCurrentHistory = ({
      fallbackIndex,
    }: {
      fallbackIndex?: number;
    } = {}) => {
      const stateIndex = getNavigationGuardHistoryIndex(window.history.state);

      if (stateIndex !== null) {
        currentHistoryIndex = stateIndex;
      } else if (fallbackIndex !== undefined) {
        currentHistoryIndex = fallbackIndex;
      }

      currentUrl = window.location.href;
    };

    /*
     * pushState로 새로운 History entry가 생성될 때
     * 현재 entry보다 1 큰 guard index를 기록합니다.
     */
    const performPushState = (...args: Parameters<History["pushState"]>) => {
      const nextHistoryIndex = currentHistoryIndex + 1;

      const nextState = withNavigationGuardHistoryIndex(
        args[0],
        nextHistoryIndex,
      );

      originalPushState.call(window.history, nextState, args[1], args[2]);

      currentHistoryIndex = nextHistoryIndex;

      syncCurrentHistory({
        fallbackIndex: nextHistoryIndex,
      });
    };

    /*
     * replaceState는 현재 History entry를 교체하는 동작이므로
     * guard index는 증가시키지 않습니다.
     */
    const performReplaceState = (
      ...args: Parameters<History["replaceState"]>
    ) => {
      const nextState = withNavigationGuardHistoryIndex(
        args[0],
        currentHistoryIndex,
      );

      originalReplaceState.call(window.history, nextState, args[1], args[2]);

      syncCurrentHistory({
        fallbackIndex: currentHistoryIndex,
      });
    };

    const requestNavigation = (navigate: () => void) => {
      /*
       * 이미 하나의 이동을 확인 중이라면 뒤이어 발생한 이동 요청으로
       * 기존 목적지를 덮어쓰지 않습니다.
       */
      if (pendingNavigationRef.current) {
        return;
      }

      /*
       * 실제 이동 함수를 저장해 사용자 선택 전까지 보류합니다.
       *
       * AlertDialog를 여는 state 갱신은 현재 React 실행 단계가 끝난 뒤
       * 처리합니다.
       *
       * Next.js App Router는 내부 navigation 과정에서 History API를
       * React의 useInsertionEffect 중 호출할 수 있으므로,
       * 패치한 pushState/replaceState 안에서 동기적으로 state를 갱신하면
       * "useInsertionEffect must not schedule updates" 오류가 발생합니다.
       */
      pendingNavigationRef.current = navigate;

      queueMicrotask(() => {
        if (pendingNavigationRef.current) {
          setIsNavigationPending(true);
        }
      });
    };

    /**
     * Next.js Link를 포함한 앱 내부 anchor 이동을
     * Next.js가 처리하기 전에 capture 단계에서 가로챕니다.
     */
    const handleDocumentClick = (event: MouseEvent) => {
      if (allowNextLinkClickRef.current) {
        allowNextLinkClickRef.current = false;
        return;
      }

      /*
       * guard가 비활성화된 상태에서는 새로운 이동을 가로채지 않습니다.
       *
       * 이미 보류된 navigation은 enabled와 독립적으로 유지되며,
       * confirmNavigation 또는 cancelNavigation에서만 종료됩니다.
       */
      if (!enabledRef.current) {
        return;
      }

      /*
       * 현재 탭에서 발생하는 일반적인 좌클릭 이동만 처리합니다.
       *
       * 새 탭 열기나 보조키를 사용한 이동은 현재 페이지를 떠나는
       * 동작이 아니므로 guard 대상으로 취급하지 않습니다.
       */
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>("a[href]");

      if (!anchor) {
        return;
      }

      if (anchor.hasAttribute("download")) {
        return;
      }

      if (anchor.target && anchor.target !== "_self") {
        return;
      }

      const nextUrl = new URL(anchor.href, window.location.href);

      /*
       * 외부 사이트 이동은 내부 navigation guard의 책임이 아닙니다.
       * 실제 브라우저 이탈은 useBeforeUnloadGuard에서 처리합니다.
       */
      if (nextUrl.origin !== window.location.origin) {
        return;
      }

      if (nextUrl.href === currentUrl) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      requestNavigation(() => {
        /*
         * 사용자가 이동을 확인하면 원래 Link 클릭을 다시 실행합니다.
         *
         * 다시 실행된 Link와 그 과정에서 발생하는 History 변경을
         * 각각 한 번씩 허용해 동일한 경고가 반복되지 않도록 합니다.
         */
        allowNextLinkClickRef.current = true;
        allowNextHistoryChangeRef.current = true;

        anchor.click();
      });
    };

    document.addEventListener("click", handleDocumentClick, {
      capture: true,
    });

    /*
     * Next.js App Router는 같은 URL에서 history state만 변경할 수 있으므로
     * 실제 URL이 바뀌지 않는 경우에는 경고 없이 허용합니다.
     */
    window.history.pushState = function (
      ...args: Parameters<History["pushState"]>
    ) {
      if (allowNextHistoryChangeRef.current) {
        allowNextHistoryChangeRef.current = false;
        performPushState(...args);
        return;
      }

      const nextUrl = resolveHistoryUrl(args[2]);

      /*
       * guard가 비활성화되어 있거나 URL 자체가 변경되지 않는 경우에는
       * History 변경을 그대로 허용하고 현재 위치만 동기화합니다.
       */
      if (!enabledRef.current || nextUrl === currentUrl) {
        performPushState(...args);
        return;
      }

      requestNavigation(() => {
        allowNextHistoryChangeRef.current = true;
        window.history.pushState(...args);
      });
    };

    window.history.replaceState = function (
      ...args: Parameters<History["replaceState"]>
    ) {
      if (allowNextHistoryChangeRef.current) {
        allowNextHistoryChangeRef.current = false;
        performReplaceState(...args);
        return;
      }

      const nextUrl = resolveHistoryUrl(args[2]);

      /*
       * guard가 비활성화되어 있거나 URL 자체가 변경되지 않는 경우에는
       * History 변경을 그대로 허용하고 현재 위치만 동기화합니다.
       */
      if (!enabledRef.current || nextUrl === currentUrl) {
        performReplaceState(...args);
        return;
      }

      requestNavigation(() => {
        allowNextHistoryChangeRef.current = true;
        window.history.replaceState(...args);
      });
    };

    /*
     * App Router에는 공식 navigation blocker가 없으므로
     * 브라우저 뒤로가기/앞으로가기는 popstate 이후 History 위치를
     * 원래 entry로 복구한 뒤 사용자 확인을 받습니다.
     *
     * pushState로 현재 URL을 새로 추가하지 않고 history.go()로
     * 기존 entry에 복귀하므로 forward history를 새로 덮어쓰지 않습니다.
     */
    const handlePopState = (event: PopStateEvent) => {
      /*
       * 사용자 확인 후 우리가 다시 실행한 popstate입니다.
       *
       * enabled가 그 사이 false가 되었더라도 이미 사용자가 이동을
       * 확인한 navigation이므로 그대로 허용합니다.
       */
      const allowedTargetIndex = allowedPopStateTargetIndexRef.current;

      if (allowedTargetIndex !== null) {
        allowedPopStateTargetIndexRef.current = null;

        /*
         * guard가 설치되기 전에 만들어진 History entry에는
         * guard index가 없을 수 있으므로 도착한 entry에도 index를 기록합니다.
         */
        const nextState = withNavigationGuardHistoryIndex(
          event.state,
          allowedTargetIndex,
        );

        originalReplaceState.call(
          window.history,
          nextState,
          "",
          window.location.href,
        );

        currentHistoryIndex = allowedTargetIndex;
        currentUrl = window.location.href;

        return;
      }

      /*
       * 최초 popstate 이후 원래 History entry로 복귀하면서 발생한
       * 두 번째 popstate입니다.
       *
       * 최초 이동은 Next.js에 전달하지 않았으므로 복귀 이벤트 역시
       * 전달하지 않고, 복귀가 완료된 뒤 사용자 확인 Dialog를 엽니다.
       */
      const pendingRestore = pendingPopStateRestoreRef.current;

      if (pendingRestore !== null) {
        event.stopImmediatePropagation();

        pendingPopStateRestoreRef.current = null;

        syncCurrentHistory({
          fallbackIndex: currentHistoryIndex,
        });

        requestNavigation(() => {
          allowedPopStateTargetIndexRef.current = pendingRestore.targetIndex;

          window.history.go(pendingRestore.delta);
        });

        return;
      }

      /*
       * guard가 비활성화된 상태에서는 브라우저 History 이동을
       * 가로채지 않고 현재 위치만 동기화합니다.
       */
      if (!enabledRef.current) {
        syncCurrentHistory();
        return;
      }

      const nextUrl = window.location.href;

      /*
       * URL은 같고 History state만 변경된 경우에는
       * 기존 정책대로 navigation guard를 표시하지 않습니다.
       */
      if (nextUrl === currentUrl) {
        const nextHistoryIndex = getNavigationGuardHistoryIndex(event.state);

        if (nextHistoryIndex !== null) {
          currentHistoryIndex = nextHistoryIndex;
        }

        return;
      }

      const targetHistoryIndex = getNavigationGuardHistoryIndex(event.state);

      /*
       * guard가 활성화된 뒤 만들어진 entry라면 기록된 index로
       * 뒤/앞 이동 방향과 거리를 계산할 수 있습니다.
       *
       * guard가 설치되기 이전 entry에는 index가 없을 수 있으므로
       * 일반적인 브라우저 뒤로가기 1회를 fallback으로 사용합니다.
       */
      const targetIndex = targetHistoryIndex ?? currentHistoryIndex - 1;

      const delta = targetIndex - currentHistoryIndex;

      if (delta === 0) {
        syncCurrentHistory({
          fallbackIndex: currentHistoryIndex,
        });
        return;
      }

      /*
       * popstate가 발생한 시점에는 브라우저 History 위치가 이미
       * 사용자가 요청한 entry로 이동한 상태입니다.
       *
       * Next.js가 이 이동을 처리하기 전에 이벤트 전파를 막고,
       * 이동한 거리의 반대 방향으로 이동하여 원래 entry를 복구합니다.
       */
      event.stopImmediatePropagation();

      pendingPopStateRestoreRef.current = {
        delta,
        targetIndex,
      };

      window.history.go(-delta);
    };

    window.addEventListener("popstate", handlePopState, {
      capture: true,
    });

    return () => {
      document.removeEventListener("click", handleDocumentClick, {
        capture: true,
      });

      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;

      window.removeEventListener("popstate", handlePopState, {
        capture: true,
      });

      /*
       * 여기서는 컴포넌트 자체가 unmount되는 경우에만 cleanup됩니다.
       *
       * enabled 변경은 이 effect를 다시 실행하지 않으므로
       * 실행 완료 때문에 이미 열린 navigation 경고가 제거되지 않습니다.
       */
      pendingNavigationRef.current = null;
      pendingPopStateRestoreRef.current = null;
      allowedPopStateTargetIndexRef.current = null;
    };
  }, []);

  return {
    cancelNavigation,
    confirmNavigation,
    isNavigationPending,
  };
}
