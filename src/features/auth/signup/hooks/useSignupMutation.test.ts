import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSignupMutation } from "@/features/auth/signup/hooks/useSignupMutation";
import { buildSignupRequestPayload } from "@/features/auth/signup/lib/buildSignupRequestPayload";

const mockFetch = vi.fn();

vi.stubGlobal("fetch", mockFetch);
vi.mock("@/features/auth/lib/buildSignupRequestPayload");

const validSignupPayload = {
  email: "test@example.com",
  password: "Password123!",
  nickname: "tester",
  agreements: {
    termsOfService: true as const,
    privacyPolicy: true as const,
  },
};

const signupSuccessResponse = {
  data: {
    email: "test@example.com",
    redirectTo: "/login",
    signupAccountStatus: "pending",
  },
};

const jsonRequestMock = {
  requestType: "json" as const,
  body: {
    email: "test@example.com",
    password: "Password123!",
    nickname: "tester",
    agreements: { termsOfService: true, privacyPolicy: true },
  },
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

describe("PR-UI-12: useSignupMutation 요청 연결", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.mocked(buildSignupRequestPayload).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("TC-01: buildSignupRequestPayload가 json을 반환하면 Content-Type application/json과 직렬화된 body로 fetch가 호출된다", async () => {
    vi.mocked(buildSignupRequestPayload).mockReturnValue(jsonRequestMock);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => signupSuccessResponse,
    });

    const { result } = renderHook(() => useSignupMutation(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync(validSignupPayload);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonRequestMock.body),
    });
  });

  it("TC-02: buildSignupRequestPayload가 multipart를 반환하면 Content-Type 없이 FormData body로 fetch가 호출된다", async () => {
    const formData = new FormData();
    vi.mocked(buildSignupRequestPayload).mockReturnValue({
      requestType: "multipart",
      body: formData,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => signupSuccessResponse,
    });

    const { result } = renderHook(() => useSignupMutation(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync(validSignupPayload);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith("/api/auth/signup", {
      method: "POST",
      body: formData,
    });
  });

  it("TC-03: fetch가 ok: true로 응답하면 mutationFn이 응답 객체를 그대로 반환한다", async () => {
    vi.mocked(buildSignupRequestPayload).mockReturnValue(jsonRequestMock);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => signupSuccessResponse,
    });

    const { result } = renderHook(() => useSignupMutation(), {
      wrapper: createWrapper(),
    });
    const response = await result.current.mutateAsync(validSignupPayload);

    expect(response).toEqual(signupSuccessResponse);
  });

  it("TC-04: fetch가 ok: false로 응답하면 mutationFn이 Error를 throw한다", async () => {
    vi.mocked(buildSignupRequestPayload).mockReturnValue(jsonRequestMock);
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) });

    const { result } = renderHook(() => useSignupMutation(), {
      wrapper: createWrapper(),
    });

    await expect(
      result.current.mutateAsync(validSignupPayload),
    ).rejects.toThrow(Error);
  });

  it("TC-05: mutationFn은 buildSignupRequestPayload를 payload와 함께 정확히 1회 호출한다", async () => {
    vi.mocked(buildSignupRequestPayload).mockReturnValue(jsonRequestMock);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => signupSuccessResponse,
    });

    const { result } = renderHook(() => useSignupMutation(), {
      wrapper: createWrapper(),
    });
    await result.current.mutateAsync(validSignupPayload);

    expect(vi.mocked(buildSignupRequestPayload)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(buildSignupRequestPayload)).toHaveBeenCalledWith(
      validSignupPayload,
    );
  });
});
