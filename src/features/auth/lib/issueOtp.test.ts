import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OTP_GENERATE_LINK_TIMEOUT_MS } from "../constants/otp";
import {
  createOtpIssueClient,
  issueOtp,
  type OtpIssueClient,
} from "./issueOtp";

const { mockCreateAdminClient, mockGenerateLink } = vi.hoisted(() => {
  const mockGenerateLink = vi.fn();
  const mockCreateAdminClient = vi.fn(
    (_options?: { fetch?: typeof fetch }) => ({
      auth: {
        admin: {
          generateLink: mockGenerateLink,
        },
      },
    }),
  );

  return {
    mockCreateAdminClient,
    mockGenerateLink,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mockCreateAdminClient,
}));

function getProviderFetch(): typeof fetch {
  const options = mockCreateAdminClient.mock.calls.at(-1)?.[0];

  if (!options?.fetch) {
    throw new Error("OTP provider fetch was not configured");
  }

  return options.fetch;
}

describe("issueOtp", () => {
  let client: OtpIssueClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createOtpIssueClient();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("createOtpIssueClient는 Provider operation을 시작하지 않는다", () => {
    mockCreateAdminClient.mockClear();
    mockGenerateLink.mockClear();

    createOtpIssueClient();

    expect(mockCreateAdminClient).toHaveBeenCalledTimes(1);
    expect(mockGenerateLink).not.toHaveBeenCalled();
  });

  it("issueOtp는 전달받은 prepared client를 사용하고 새 client를 생성하지 않는다", async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: null, user: null },
      error: null,
    });
    mockCreateAdminClient.mockClear();

    await issueOtp({
      email: "test@example.com",
      purpose: "signup",
      signupMode: "existing-user",
      client,
    });

    expect(mockCreateAdminClient).not.toHaveBeenCalled();
    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
  });

  it("신규 Signup은 signup type과 password/metadata를 Provider에 전달한다", async () => {
    mockGenerateLink.mockResolvedValue({
      data: {
        properties: {
          email_otp: "123456",
        },
        user: {
          id: "new-user-id",
        },
      },
      error: null,
    });

    await issueOtp({
      email: "Raw.Email@example.com",
      purpose: "signup",
      signupMode: "new-user",
      password: "StrongPassword123!",
      metadata: {
        nickname: "딱다구리",
        canonical_email: "raw.email@example.com",
      },
      client,
    });

    expect(mockGenerateLink).toHaveBeenCalledWith({
      email: "Raw.Email@example.com",
      password: "StrongPassword123!",
      type: "signup",
      options: {
        data: {
          nickname: "딱다구리",
          canonical_email: "raw.email@example.com",
        },
      },
    });
  });

  it("신규 Signup은 Provider가 반환한 user id를 최소 정보로 보존한다", async () => {
    const properties = {
      email_otp: "123456",
      hashed_token: "hashed-token",
      action_link: "https://example.com",
    };

    mockGenerateLink.mockResolvedValue({
      data: {
        properties,
        user: {
          id: "new-user-id",
        },
      },
      error: null,
    });

    const result = await issueOtp({
      email: "test@example.com",
      purpose: "signup",
      signupMode: "new-user",
      password: "StrongPassword123!",
      metadata: {
        nickname: "딱다구리",
        canonical_email: "test@example.com",
      },
      client,
    });

    expect(result).toEqual({
      otp: properties,
      userId: "new-user-id",
      error: null,
    });
  });

  it("기존 Signup 사용자는 magiclink type으로 재발급한다", async () => {
    mockGenerateLink.mockResolvedValue({
      data: {
        properties: {
          email_otp: "123456",
        },
        user: null,
      },
      error: null,
    });

    await issueOtp({
      email: "test@example.com",
      purpose: "signup",
      signupMode: "existing-user",
      client,
    });

    expect(mockGenerateLink).toHaveBeenCalledWith({
      email: "test@example.com",
      type: "magiclink",
    });
  });

  it("reset-password purpose는 recovery type으로 변환한다", async () => {
    mockGenerateLink.mockResolvedValue({
      data: {
        properties: {
          email_otp: "123456",
        },
        user: null,
      },
      error: null,
    });

    await issueOtp({
      email: "test@example.com",
      purpose: "reset-password",
      client,
    });

    expect(mockGenerateLink).toHaveBeenCalledWith({
      email: "test@example.com",
      type: "recovery",
    });
  });

  it("generateLink 결과 properties를 otp로 반환한다", async () => {
    const properties = {
      email_otp: "123456",
      hashed_token: "hashed-token",
      action_link: "https://example.com",
    };

    mockGenerateLink.mockResolvedValue({
      data: {
        properties,
        user: null,
      },
      error: null,
    });

    const result = await issueOtp({
      email: "test@example.com",
      purpose: "signup",
      signupMode: "existing-user",
      client,
    });

    expect(result).toEqual({
      otp: properties,
      userId: null,
      error: null,
    });
  });

  it("Provider error를 그대로 반환한다", async () => {
    const error = {
      message: "failed",
    };

    mockGenerateLink.mockResolvedValue({
      data: {
        properties: null,
        user: null,
      },
      error,
    });

    const result = await issueOtp({
      email: "test@example.com",
      purpose: "signup",
      signupMode: "existing-user",
      client,
    });

    expect(result.error).toBe(error);
  });

  it("properties와 user가 없으면 otp와 userId를 null로 반환한다", async () => {
    mockGenerateLink.mockResolvedValue({
      data: {
        properties: undefined,
        user: undefined,
      },
      error: null,
    });

    const result = await issueOtp({
      email: "test@example.com",
      purpose: "signup",
      signupMode: "existing-user",
      client,
    });

    expect(result).toEqual({
      otp: null,
      userId: null,
      error: null,
    });
  });

  it("OTP provider fetch에 10초 timeout signal을 적용한다", async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: null, user: null },
      error: null,
    });

    await issueOtp({
      email: "test@example.com",
      purpose: "signup",
      signupMode: "existing-user",
      client,
    });

    const providerFetch = getProviderFetch();
    const timeoutSignal = new AbortController().signal;
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutSignal);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response());

    vi.stubGlobal("fetch", fetchMock);

    await providerFetch("https://example.com");

    expect(timeoutSpy).toHaveBeenCalledWith(OTP_GENERATE_LINK_TIMEOUT_MS);
    expect(fetchMock).toHaveBeenCalledWith("https://example.com", {
      signal: timeoutSignal,
    });
  });

  it("RequestInit signal과 OTP timeout signal을 함께 보존한다", async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: null, user: null },
      error: null,
    });

    await issueOtp({
      email: "test@example.com",
      purpose: "signup",
      signupMode: "existing-user",
      client,
    });

    const providerFetch = getProviderFetch();
    const existingSignal = new AbortController().signal;
    const timeoutSignal = new AbortController().signal;
    const combinedSignal = new AbortController().signal;

    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutSignal);
    const anySpy = vi.spyOn(AbortSignal, "any").mockReturnValue(combinedSignal);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response());

    vi.stubGlobal("fetch", fetchMock);

    await providerFetch("https://example.com", {
      signal: existingSignal,
    });

    expect(anySpy).toHaveBeenCalledWith([existingSignal, timeoutSignal]);
    expect(fetchMock).toHaveBeenCalledWith("https://example.com", {
      signal: combinedSignal,
    });
  });

  it("RequestInit signal이 없으면 Request signal을 보존한다", async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: null, user: null },
      error: null,
    });

    await issueOtp({
      email: "test@example.com",
      purpose: "signup",
      signupMode: "existing-user",
      client,
    });

    const providerFetch = getProviderFetch();
    const request = new Request("https://example.com", {
      signal: new AbortController().signal,
    });
    const timeoutSignal = new AbortController().signal;
    const combinedSignal = new AbortController().signal;

    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutSignal);
    const anySpy = vi.spyOn(AbortSignal, "any").mockReturnValue(combinedSignal);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response());

    vi.stubGlobal("fetch", fetchMock);

    await providerFetch(request);

    expect(anySpy).toHaveBeenCalledWith([request.signal, timeoutSignal]);
    expect(fetchMock).toHaveBeenCalledWith(request, {
      signal: combinedSignal,
    });
  });

  it("RequestInit signal이 null이면 Request signal로 되돌아가지 않는다", async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: null, user: null },
      error: null,
    });

    await issueOtp({
      email: "test@example.com",
      purpose: "signup",
      signupMode: "existing-user",
      client,
    });

    const providerFetch = getProviderFetch();
    const request = new Request("https://example.com", {
      signal: new AbortController().signal,
    });
    const timeoutSignal = new AbortController().signal;

    vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeoutSignal);
    const anySpy = vi.spyOn(AbortSignal, "any");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response());

    vi.stubGlobal("fetch", fetchMock);

    await providerFetch(request, {
      signal: null,
    });

    expect(anySpy).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(request, {
      signal: timeoutSignal,
    });
  });
});
