"use client";

import { useCallback, useEffect, useState } from "react";

// 유휴 시간이 오지 않아도 이 시간 안에는 반드시 불러온다.
const IDLE_LOAD_TIMEOUT_MS = 2000;

/**
 * 에디터 번들 평가와 생성은 긴 작업을 만든다. hydration 직후에 바로 실행하지 않고
 * 브라우저 유휴 시간에 불러오되, 그 전에 사용자가 폼을 만지면 즉시 불러온다.
 */
export function useDeferredEditorLoad() {
  const [shouldLoad, setShouldLoad] = useState(false);
  const requestLoad = useCallback(() => setShouldLoad(true), []);

  useEffect(() => {
    if (shouldLoad) return;

    // Safari 등 requestIdleCallback이 없는 브라우저는 다음 태스크로 미룬다.
    if (typeof window.requestIdleCallback !== "function") {
      const timer = window.setTimeout(requestLoad, 0);
      return () => window.clearTimeout(timer);
    }

    const handle = window.requestIdleCallback(requestLoad, {
      timeout: IDLE_LOAD_TIMEOUT_MS,
    });
    return () => window.cancelIdleCallback(handle);
  }, [shouldLoad, requestLoad]);

  return { shouldLoad, requestLoad };
}
