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

  it("generic network reject로 settle된 뒤 late own timeout이 와도 false를 유지한다", async () => {
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

    timeoutController.abort(new DOMException("late timeout", "TimeoutError"));
    expect(context.didTimeout()).toBe(false);
  });

  it("fetch success로 settle된 뒤 late own timeout이 와도 false를 유지한다", async () => {
    const timeoutController = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutController.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );

    const context = createAuthProviderTimeoutContext({
      timeoutMs: AUTH_PROVIDER_TIMEOUT_MS,
    });

    await expect(
      context.fetch("https://provider.test/auth/v1/token"),
    ).resolves.toBeInstanceOf(Response);

    timeoutController.abort(new DOMException("late timeout", "TimeoutError"));
    expect(context.didTimeout()).toBe(false);
  });
});
