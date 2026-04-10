"use client";

import { useEffect } from "react";

const PAGE_LEAVE_CONFIRM_MESSAGE =
  "페이지를 떠나시겠습니까? 작성 중인 내용이 저장되지 않습니다.";

function resolveHistoryUrl(url?: string | URL | null) {
  if (url == null) {
    return window.location.href;
  }

  return new URL(url, window.location.href).href;
}

export function usePreventPageLeave(shouldPrevent: boolean) {
  useEffect(() => {
    if (!shouldPrevent) return;

    let currentUrl = window.location.href;
    let currentHistoryState: unknown = window.history.state;
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    const syncCurrentHistory = () => {
      currentUrl = window.location.href;
      currentHistoryState = window.history.state;
    };

    const confirmPageLeave = () => window.confirm(PAGE_LEAVE_CONFIRM_MESSAGE);

    // Next.js App Router가 같은 URL에서 state만 변경하는 pushState를 내부적으로 사용하므로 허용
    const canChangeUrl = (nextUrl: string) =>
      nextUrl === currentUrl || confirmPageLeave();

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // TODO: App Router에는 공식 navigation blocker가 없어 History API를 패치한다.
    // 라우터 내부 상태와 어긋날 수 있으므로 공식 API가 생기면 이 우회 구현을 교체한다.
    window.history.pushState = function (
      ...args: Parameters<History["pushState"]>
    ) {
      const nextUrl = resolveHistoryUrl(args[2]);

      if (canChangeUrl(nextUrl)) {
        originalPushState.call(window.history, ...args);
        syncCurrentHistory();
      }
    };

    window.history.replaceState = function (
      ...args: Parameters<History["replaceState"]>
    ) {
      const nextUrl = resolveHistoryUrl(args[2]);

      if (canChangeUrl(nextUrl)) {
        originalReplaceState.call(window.history, ...args);
        syncCurrentHistory();
      }
    };

    const handlePopState = (event: PopStateEvent) => {
      const nextUrl = window.location.href;

      if (nextUrl === currentUrl) {
        currentHistoryState = event.state;
        return;
      }

      if (confirmPageLeave()) {
        currentUrl = nextUrl;
        currentHistoryState = event.state;
        return;
      }

      event.stopImmediatePropagation();
      // 브라우저 제약상 pushState로 현재 URL을 복구하면 forward 이력이 사라지는 trade-off가 있다.
      originalPushState.call(
        window.history,
        currentHistoryState,
        "",
        currentUrl,
      );
    };

    window.addEventListener("popstate", handlePopState, { capture: true });

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handlePopState, { capture: true });
    };
  }, [shouldPrevent]);
}
