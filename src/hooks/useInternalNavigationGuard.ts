"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function resolveHistoryUrl(url?: string | URL | null) {
  if (url == null) {
    return window.location.href;
  }

  return new URL(url, window.location.href).href;
}

type UseInternalNavigationGuardParams = {
  enabled: boolean;
};

/**
 * 앱 내부 페이지 이동을 감지하고 사용자 확인 전까지 보류합니다.
 *
 * 실제 경고 UI는 이 Hook에서 다루지 않습니다.
 * 이동이 감지되면 isNavigationPending을 true로 만들고,
 * 호출부에서 confirmNavigation 또는 cancelNavigation을 호출해
 * 이동 여부를 결정합니다.
 *
 * Next.js Link 클릭과 History API를 통한 프로그래밍 방식의 이동을
 * 모두 처리합니다.
 *
 * @param params Hook 입력값
 * @param params.enabled 이동 경고 활성화 여부
 * @returns 보류 상태와 이동 확인/취소 액션
 */
export function useInternalNavigationGuard({
  enabled,
}: UseInternalNavigationGuardParams) {
  const [isNavigationPending, setIsNavigationPending] = useState(false);

  const pendingNavigationRef = useRef<(() => void) | null>(null);

  /*
   * 사용자가 AlertDialog에서 이동을 확인한 뒤
   * 동일한 Link 클릭이나 History 변경을 다시 실행할 때
   * guard가 다시 가로채지 않도록 사용합니다.
   */
  const allowNextLinkClickRef = useRef(false);
  const allowNextHistoryChangeRef = useRef(false);
  const allowNextPopStateRef = useRef(false);

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
    if (!enabled) {
      pendingNavigationRef.current = null;
      setIsNavigationPending(false);
      return;
    }

    let currentUrl = window.location.href;
    let currentHistoryState: unknown = window.history.state;

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const syncCurrentHistory = () => {
      currentUrl = window.location.href;
      currentHistoryState = window.history.state;
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
       * 이동 자체는 즉시 보류하되 AlertDialog를 여는 state 갱신은
       * 현재 React 실행 단계가 끝난 뒤 처리합니다.
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
        originalPushState.call(window.history, ...args);
        syncCurrentHistory();
        return;
      }

      const nextUrl = resolveHistoryUrl(args[2]);

      if (nextUrl === currentUrl) {
        originalPushState.call(window.history, ...args);
        syncCurrentHistory();
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
        originalReplaceState.call(window.history, ...args);
        syncCurrentHistory();
        return;
      }

      const nextUrl = resolveHistoryUrl(args[2]);

      if (nextUrl === currentUrl) {
        originalReplaceState.call(window.history, ...args);
        syncCurrentHistory();
        return;
      }

      requestNavigation(() => {
        allowNextHistoryChangeRef.current = true;
        window.history.replaceState(...args);
      });
    };

    // TODO: App Router에는 공식 navigation blocker가 없어 History API를 패치한다.
    // popstate 취소 시 이미 변경된 URL을 pushState로 복구하므로
    // 브라우저의 forward history가 변경될 수 있다.
    // 공식 navigation blocker API가 제공되면 이 우회 구현을 교체한다.
    const handlePopState = (event: PopStateEvent) => {
      if (allowNextPopStateRef.current) {
        allowNextPopStateRef.current = false;
        syncCurrentHistory();
        return;
      }

      const nextUrl = window.location.href;

      if (nextUrl === currentUrl) {
        currentHistoryState = event.state;
        return;
      }

      event.stopImmediatePropagation();

      /*
       * popstate는 이벤트가 발생한 시점에 이미 브라우저 history 위치와
       * URL이 변경된 상태이므로 사용자 확인을 받기 위해 현재 URL을 복구합니다.
       */
      originalPushState.call(
        window.history,
        currentHistoryState,
        "",
        currentUrl,
      );

      requestNavigation(() => {
        allowNextPopStateRef.current = true;
        window.history.back();
      });
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

      pendingNavigationRef.current = null;
    };
  }, [enabled]);

  return {
    cancelNavigation,
    confirmNavigation,
    isNavigationPending,
  };
}
