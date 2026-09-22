type AuthProviderTimeoutContext = {
  fetch: typeof fetch;
  didTimeout: () => boolean;
  settle: () => void;
};

type AbortSource = "external" | "timeout";

/**
 * Auth Provider operation 하나에 bounded-settle timeout attribution을 적용한다.
 *
 * - context 생성만으로 timer를 시작하지 않는다.
 * - 실제 fetch invocation 시점에 timeout budget을 시작한다.
 * - 기존 abort signal이 있으면 유지하면서 own timeout과 합성한다.
 * - RequestInit.signal이 명시된 경우 Request.signal보다 우선한다.
 * - 첫 abort source가 own timeout인 경우에만 didTimeout()이 true다.
 * - Response 반환 뒤에도 Provider operation이 끝날 때까지 abort source를 추적한다.
 * - caller가 settle()을 호출하면 attribution을 freeze하고 active listener를 정리한다.
 * - 이 context는 서로 독립적인 Provider operation 사이에 재사용하지 않는다.
 * - 현재 지원·검증 범위는 한 Provider operation당 하나의 핵심 transport fetch다.
 * - multi-fetch operation에서는 이전 fetch의 stale timeout/external abort가 operation-level
 *   attribution에 영향을 줄 수 있어 안전성을 보장하지 않는다.
 * - multi-fetch 사용처가 생기면 현재 lifecycle 설계를 그대로 확장하지 않고 재검토한다.
 */
export function createAuthProviderTimeoutContext({
  timeoutMs,
}: {
  timeoutMs: number;
}): AuthProviderTimeoutContext {
  let firstAbortSource: AbortSource | null = null;
  let settled = false;
  const listenerCleanups = new Set<() => void>();

  const latchAbortSource = (source: AbortSource) => {
    if (!settled && firstAbortSource === null) {
      firstAbortSource = source;
    }
  };

  const providerFetch: typeof fetch = async (input, init) => {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);

    let externalSignal: AbortSignal | undefined;

    if (init?.signal !== undefined) {
      externalSignal = init.signal ?? undefined;
    } else if (input instanceof Request) {
      externalSignal = input.signal;
    }

    const handleExternalAbort = () => latchAbortSource("external");
    const handleTimeoutAbort = () => latchAbortSource("timeout");

    if (externalSignal?.aborted) {
      latchAbortSource("external");
    } else if (timeoutSignal.aborted) {
      latchAbortSource("timeout");
    }

    if (externalSignal && !externalSignal.aborted) {
      externalSignal.addEventListener("abort", handleExternalAbort, {
        once: true,
      });
    }

    if (!timeoutSignal.aborted) {
      timeoutSignal.addEventListener("abort", handleTimeoutAbort, {
        once: true,
      });
    }

    const cleanupListeners = () => {
      externalSignal?.removeEventListener("abort", handleExternalAbort);
      timeoutSignal.removeEventListener("abort", handleTimeoutAbort);
    };

    listenerCleanups.add(cleanupListeners);

    const signal = externalSignal
      ? AbortSignal.any([externalSignal, timeoutSignal])
      : timeoutSignal;

    return fetch(input, {
      ...init,
      signal,
    });
  };

  const settle = () => {
    if (settled) return;

    settled = true;

    for (const cleanup of listenerCleanups) {
      cleanup();
    }

    listenerCleanups.clear();
  };

  return {
    fetch: providerFetch,
    didTimeout: () => firstAbortSource === "timeout",
    settle,
  };
}
