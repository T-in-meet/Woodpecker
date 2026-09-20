import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_PROVIDER_TIMEOUT_MS } from "../constants/authProviderTimeout";
import { createAuthProviderTimeoutContext } from "./authProviderTimeout";

function createAbortAwareTransport() {
  return vi.fn(
    (_input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;

        if (!signal) {
          reject(new Error("expected composed signal"));
          return;
        }

        const rejectAbort = () =>
          reject(signal.reason ?? new DOMException("Aborted", "AbortError"));

        if (signal.aborted) {
          rejectAbort();
          return;
        }

        signal.addEventListener("abort", rejectAbort, { once: true });
      }),
  );
}

function createDeferredTransport() {
  let rejectRequest: ((reason?: unknown) => void) | undefined;
  let resolveRequest: ((response: Response) => void) | undefined;

  const transportFetch = vi.fn(
    (
      _input: Parameters<typeof fetch>[0],
      _init?: Parameters<typeof fetch>[1],
    ) =>
      new Promise<Response>((resolve, reject) => {
        resolveRequest = resolve;
        rejectRequest = reject;
      }),
  );

  return {
    transportFetch,
    reject(reason: unknown) {
      if (!rejectRequest) throw new Error("transport fetch was not started");
      rejectRequest(reason);
    },
    resolve(response: Response) {
      if (!resolveRequest) throw new Error("transport fetch was not started");
      resolveRequest(response);
    },
  };
}

function createBodyPendingTransport() {
  return vi.fn(
    (
      _input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ) => {
      const signal = init?.signal;

      if (!signal) {
        return Promise.reject(new Error("expected composed signal"));
      }

      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          const rejectBody = () =>
            controller.error(
              signal.reason ?? new DOMException("Aborted", "AbortError"),
            );

          if (signal.aborted) {
            rejectBody();
            return;
          }

          signal.addEventListener("abort", rejectBody, { once: true });
        },
      });

      return Promise.resolve(
        new Response(body, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    },
  );
}

function getLifecycleEnd(
  context: ReturnType<typeof createAuthProviderTimeoutContext>,
): (() => void) | undefined {
  const lifecycleContext = context as unknown as {
    settle?: () => void;
    dispose?: () => void;
  };

  return lifecycleContext.settle ?? lifecycleContext.dispose;
}
function getPassedSignal(transportFetch: ReturnType<typeof vi.fn>) {
  const call = transportFetch.mock.calls[0] as
    | [Parameters<typeof fetch>[0], Parameters<typeof fetch>[1]?]
    | undefined;
  return call?.[1]?.signal;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("createAuthProviderTimeoutContext", () => {
  it("context 생성만으로 timeout을 시작하지 않고 실제 fetch invocation에서 full budget을 시작한다", async () => {
    const timeoutController = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutController.signal);
    const transportFetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", transportFetch);

    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    expect(timeoutSpy).not.toHaveBeenCalled();
    expect(context.didTimeout()).toBe(false);

    await context.fetch("https://provider.test/auth/v1/token");

    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(AUTH_PROVIDER_TIMEOUT_MS);
    expect(context.didTimeout()).toBe(false);
  });

  it("RequestInit.signal 단독 external abort를 own timeout으로 오분류하지 않는다", async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    const transportFetch = createAbortAwareTransport();
    vi.stubGlobal("fetch", transportFetch);

    const initController = new AbortController();
    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    const pending = context.fetch("https://provider.test/auth/v1/token", {
      signal: initController.signal,
    });

    initController.abort(new DOMException("init aborted", "AbortError"));

    await expect(pending).rejects.toBeDefined();
    expect(context.didTimeout()).toBe(false);
  });

  it("init.signal이 없으면 Request.signal을 external signal로 사용한다", async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    const transportFetch = createAbortAwareTransport();
    vi.stubGlobal("fetch", transportFetch);

    const requestController = new AbortController();
    const request = new Request("https://provider.test/auth/v1/token", {
      signal: requestController.signal,
    });
    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    const pending = context.fetch(request);
    requestController.abort(new DOMException("request aborted", "AbortError"));

    await expect(pending).rejects.toBeDefined();
    expect(context.didTimeout()).toBe(false);
  });

  it("Request.signal과 RequestInit.signal이 함께 있으면 init.signal을 우선한다", async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    const transportFetch = createAbortAwareTransport();
    vi.stubGlobal("fetch", transportFetch);

    const requestController = new AbortController();
    const initController = new AbortController();
    const request = new Request("https://provider.test/auth/v1/token", {
      signal: requestController.signal,
    });
    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    const pending = context.fetch(request, { signal: initController.signal });
    const passedSignal = getPassedSignal(transportFetch);

    expect(passedSignal).toBeDefined();

    requestController.abort(new DOMException("request aborted", "AbortError"));
    expect(passedSignal!.aborted).toBe(false);
    expect(context.didTimeout()).toBe(false);

    initController.abort(new DOMException("init aborted", "AbortError"));
    expect(passedSignal!.aborted).toBe(true);

    await expect(pending).rejects.toBeDefined();
    expect(context.didTimeout()).toBe(false);

    timeoutController.abort(new DOMException("late timeout", "TimeoutError"));
    expect(context.didTimeout()).toBe(false);
  });

  it("fetch 진입 전에 external signal이 이미 aborted면 external abort를 먼저 latch한다", async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    vi.stubGlobal("fetch", createAbortAwareTransport());

    const externalController = new AbortController();
    externalController.abort(new DOMException("already aborted", "AbortError"));

    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    await expect(
      context.fetch("https://provider.test/auth/v1/token", {
        signal: externalController.signal,
      }),
    ).rejects.toBeDefined();

    expect(context.didTimeout()).toBe(false);

    timeoutController.abort(new DOMException("late timeout", "TimeoutError"));
    expect(context.didTimeout()).toBe(false);
  });

  it("external abort가 먼저이고 fetch reject가 지연돼도 이후 own timeout으로 뒤집히지 않는다", async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    const deferred = createDeferredTransport();
    vi.stubGlobal("fetch", deferred.transportFetch);

    const externalController = new AbortController();
    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    const pending = context.fetch("https://provider.test/auth/v1/token", {
      signal: externalController.signal,
    });

    externalController.abort(new DOMException("external first", "AbortError"));
    timeoutController.abort(new DOMException("timeout second", "TimeoutError"));
    deferred.reject(new TypeError("delayed fetch reject"));

    await expect(pending).rejects.toThrow("delayed fetch reject");
    expect(context.didTimeout()).toBe(false);
  });

  it("own timeout이 먼저이고 fetch reject가 지연되면 이후 external abort가 와도 true를 유지한다", async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    const deferred = createDeferredTransport();
    vi.stubGlobal("fetch", deferred.transportFetch);

    const externalController = new AbortController();
    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    const pending = context.fetch("https://provider.test/auth/v1/token", {
      signal: externalController.signal,
    });

    timeoutController.abort(new DOMException("timeout first", "TimeoutError"));
    externalController.abort(new DOMException("external second", "AbortError"));
    deferred.reject(new TypeError("delayed fetch reject"));

    await expect(pending).rejects.toThrow("delayed fetch reject");
    expect(context.didTimeout()).toBe(true);
  });

  it("generic network reject는 timeout으로 분류하지 않는다", async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("network failed")),
    );

    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    await expect(
      context.fetch("https://provider.test/auth/v1/token"),
    ).rejects.toThrow("network failed");

    expect(context.didTimeout()).toBe(false);
  });

  it("generic network reject 후 lifecycle 종료 뒤 late own timeout이 와도 false를 유지한다", async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("network failed")),
    );

    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    await expect(
      context.fetch("https://provider.test/auth/v1/token"),
    ).rejects.toThrow("network failed");

    expect(context.didTimeout()).toBe(false);

    const lifecycleEnd = getLifecycleEnd(context);
    expect(lifecycleEnd).toBeTypeOf("function");
    lifecycleEnd!();

    timeoutController.abort(new DOMException("late timeout", "TimeoutError"));
    expect(context.didTimeout()).toBe(false);
  });

  it("Response 반환 후 Provider operation settle 전 own timeout은 timeout source로 보존한다", async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    vi.stubGlobal("fetch", createBodyPendingTransport());

    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    const response = await context.fetch("https://provider.test/auth/v1/token");
    const bodyPromise = response.text();

    timeoutController.abort(new DOMException("body timeout", "TimeoutError"));

    await expect(bodyPromise).rejects.toBeDefined();
    expect(context.didTimeout()).toBe(true);
  });

  it("Provider operation lifecycle 종료 API를 제공한다", async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );

    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    await context.fetch("https://provider.test/auth/v1/token");

    expect(getLifecycleEnd(context)).toBeTypeOf("function");
  });

  it("Provider operation 정상 종료 후 late own timeout은 attribution을 변경하지 않는다", async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );

    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    await context.fetch("https://provider.test/auth/v1/token");

    const lifecycleEnd = getLifecycleEnd(context);
    expect(lifecycleEnd).toBeTypeOf("function");
    lifecycleEnd!();

    timeoutController.abort(new DOMException("late timeout", "TimeoutError"));
    expect(context.didTimeout()).toBe(false);
  });

  it("own timeout이 먼저 latch된 뒤 lifecycle을 종료해도 true를 유지한다", async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    vi.stubGlobal("fetch", createBodyPendingTransport());

    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    const response = await context.fetch("https://provider.test/auth/v1/token");
    const bodyPromise = response.text();

    timeoutController.abort(new DOMException("body timeout", "TimeoutError"));
    await expect(bodyPromise).rejects.toBeDefined();

    const lifecycleEnd = getLifecycleEnd(context);
    expect(lifecycleEnd).toBeTypeOf("function");
    lifecycleEnd!();

    expect(context.didTimeout()).toBe(true);
  });

  it("Provider operation lifecycle 종료는 idempotent하다", async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );

    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    await context.fetch("https://provider.test/auth/v1/token");

    const lifecycleEnd = getLifecycleEnd(context);
    expect(lifecycleEnd).toBeTypeOf("function");

    expect(() => {
      lifecycleEnd!();
      lifecycleEnd!();
    }).not.toThrow();
    expect(context.didTimeout()).toBe(false);
  });

  it("Provider operation lifecycle 종료 전에는 listener를 유지하고 종료 시 own timeout listener를 제거한다", async () => {
    const timeoutController = new AbortController();
    const timeoutAddSpy = vi.spyOn(
      timeoutController.signal,
      "addEventListener",
    );
    const timeoutRemoveSpy = vi.spyOn(
      timeoutController.signal,
      "removeEventListener",
    );

    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );

    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    await context.fetch("https://provider.test/auth/v1/token");

    const timeoutAbortListener = timeoutAddSpy.mock.calls.find(
      ([type]) => type === "abort",
    )?.[1];

    expect(timeoutAbortListener).toBeDefined();
    expect(timeoutRemoveSpy).not.toHaveBeenCalledWith(
      "abort",
      timeoutAbortListener,
    );

    const lifecycleEnd = getLifecycleEnd(context);
    expect(lifecycleEnd).toBeTypeOf("function");
    lifecycleEnd!();

    expect(timeoutRemoveSpy).toHaveBeenCalledWith(
      "abort",
      timeoutAbortListener,
    );
  });

  it("Provider operation lifecycle 종료 시 external + own timeout listener를 모두 제거한다", async () => {
    const timeoutController = new AbortController();
    const externalController = new AbortController();

    const timeoutAddSpy = vi.spyOn(
      timeoutController.signal,
      "addEventListener",
    );
    const timeoutRemoveSpy = vi.spyOn(
      timeoutController.signal,
      "removeEventListener",
    );
    const externalAddSpy = vi.spyOn(
      externalController.signal,
      "addEventListener",
    );
    const externalRemoveSpy = vi.spyOn(
      externalController.signal,
      "removeEventListener",
    );

    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );

    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    await context.fetch("https://provider.test/auth/v1/token", {
      signal: externalController.signal,
    });

    const timeoutAbortListener = timeoutAddSpy.mock.calls.find(
      ([type]) => type === "abort",
    )?.[1];
    const externalAbortListener = externalAddSpy.mock.calls.find(
      ([type]) => type === "abort",
    )?.[1];

    expect(timeoutAbortListener).toBeDefined();
    expect(externalAbortListener).toBeDefined();
    expect(timeoutRemoveSpy).not.toHaveBeenCalledWith(
      "abort",
      timeoutAbortListener,
    );
    expect(externalRemoveSpy).not.toHaveBeenCalledWith(
      "abort",
      externalAbortListener,
    );

    const lifecycleEnd = getLifecycleEnd(context);
    expect(lifecycleEnd).toBeTypeOf("function");
    lifecycleEnd!();

    expect(timeoutRemoveSpy).toHaveBeenCalledWith(
      "abort",
      timeoutAbortListener,
    );
    expect(externalRemoveSpy).toHaveBeenCalledWith(
      "abort",
      externalAbortListener,
    );

    const timeoutRemoveCount = timeoutRemoveSpy.mock.calls.filter(
      ([type, listener]) =>
        type === "abort" && listener === timeoutAbortListener,
    ).length;
    const externalRemoveCount = externalRemoveSpy.mock.calls.filter(
      ([type, listener]) =>
        type === "abort" && listener === externalAbortListener,
    ).length;

    lifecycleEnd!();

    expect(
      timeoutRemoveSpy.mock.calls.filter(
        ([type, listener]) =>
          type === "abort" && listener === timeoutAbortListener,
      ),
    ).toHaveLength(timeoutRemoveCount);
    expect(
      externalRemoveSpy.mock.calls.filter(
        ([type, listener]) =>
          type === "abort" && listener === externalAbortListener,
      ),
    ).toHaveLength(externalRemoveCount);
  });
});
