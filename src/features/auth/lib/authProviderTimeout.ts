type AuthProviderTimeoutContext = {
  fetch: typeof fetch;
  didTimeout: () => boolean;
};

type AbortSource = "external" | "timeout";

/**
 * Auth Provider 요청 하나에 bounded-settle timeout을 적용한다.
 *
 * - context 생성만으로 timer를 시작하지 않는다.
 * - 실제 fetch invocation 시점에 timeout budget을 시작한다.
 * - 기존 abort signal이 있으면 유지하면서 own timeout과 합성한다.
 * - RequestInit.signal이 명시된 경우 Request.signal보다 우선한다.
 * - 첫 abort source가 own timeout인 경우에만 didTimeout()이 true다.
 * - fetch가 settle된 뒤 발생한 late abort는 결과를 변경하지 않는다.
 */
export function createAuthProviderTimeoutContext({
  timeoutMs,
}: {
  timeoutMs: number;
}): AuthProviderTimeoutContext {
  let firstAbortSource: AbortSource | null = null;

  const providerFetch: typeof fetch = async (input, init) => {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);

    let externalSignal: AbortSignal | undefined;

    if (init?.signal !== undefined) {
      externalSignal = init.signal ?? undefined;
    } else if (input instanceof Request) {
      externalSignal = input.signal;
    }

    let settled = false;

    const latchAbortSource = (source: AbortSource) => {
      if (!settled && firstAbortSource === null) {
        firstAbortSource = source;
      }
    };

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

    const signal = externalSignal
      ? AbortSignal.any([externalSignal, timeoutSignal])
      : timeoutSignal;

    try {
      return await fetch(input, {
        ...init,
        signal,
      });
    } finally {
      settled = true;
      externalSignal?.removeEventListener("abort", handleExternalAbort);
      timeoutSignal.removeEventListener("abort", handleTimeoutAbort);
    }
  };

  return {
    fetch: providerFetch,
    didTimeout: () => firstAbortSource === "timeout",
  };
}
