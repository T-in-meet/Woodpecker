import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AUTH_LOG_REASONS } from "@/features/auth/constants/authLogReasons";

import {
  getTrustedAuthClientIp,
  getTrustedAuthServerActionClientIp,
} from "./trustedAuthClientIp";

const { headersMock } = vi.hoisted(() => ({
  headersMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

/**
 * Route Handler IP 테스트용 요청을 생성한다.
 *
 * @param requestHeaders 요청에 포함할 헤더
 * @returns 테스트용 NextRequest
 */
function makeRequest(requestHeaders: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: requestHeaders,
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("getTrustedAuthClientIp", () => {
  it("Production에서 x-real-ip가 있으면 해당 IP를 반환한다", () => {
    vi.stubEnv("NODE_ENV", "production");

    const result = getTrustedAuthClientIp(
      makeRequest({
        "x-real-ip": "1.2.3.4",
      }),
    );

    expect(result).toEqual({
      available: true,
      ip: "1.2.3.4",
    });
  });

  it("Production에서 x-real-ip가 없으면 x-forwarded-for를 사용한다", () => {
    vi.stubEnv("NODE_ENV", "production");

    const result = getTrustedAuthClientIp(
      makeRequest({
        "x-forwarded-for": "5.6.7.8",
      }),
    );

    expect(result).toEqual({
      available: true,
      ip: "5.6.7.8",
    });
  });

  it("Production에서 trusted IP가 없으면 IP_UNAVAILABLE을 반환한다", () => {
    vi.stubEnv("NODE_ENV", "production");

    const result = getTrustedAuthClientIp(makeRequest());

    expect(result).toEqual({
      available: false,
      reasonCode: AUTH_LOG_REASONS.IP_UNAVAILABLE,
    });
  });

  it("Development에서 trusted IP가 없으면 로컬 fallback을 사용한다", () => {
    vi.stubEnv("NODE_ENV", "development");

    const result = getTrustedAuthClientIp(makeRequest());

    expect(result).toEqual({
      available: true,
      ip: "127.0.0.1",
    });
  });

  it("Test에서 trusted IP가 없으면 로컬 fallback을 사용한다", () => {
    vi.stubEnv("NODE_ENV", "test");

    const result = getTrustedAuthClientIp(makeRequest());

    expect(result).toEqual({
      available: true,
      ip: "127.0.0.1",
    });
  });
});

describe("getTrustedAuthServerActionClientIp", () => {
  it("Server Action에서도 Route와 동일한 IP 정책을 사용한다", async () => {
    vi.stubEnv("NODE_ENV", "production");

    headersMock.mockResolvedValue(
      new Headers({
        "x-real-ip": "9.8.7.6",
      }),
    );

    await expect(getTrustedAuthServerActionClientIp()).resolves.toEqual({
      available: true,
      ip: "9.8.7.6",
    });
  });

  it("Production Server Action에서 trusted IP가 없으면 fail-closed한다", async () => {
    vi.stubEnv("NODE_ENV", "production");
    headersMock.mockResolvedValue(new Headers());

    await expect(getTrustedAuthServerActionClientIp()).resolves.toEqual({
      available: false,
      reasonCode: AUTH_LOG_REASONS.IP_UNAVAILABLE,
    });
  });
});
