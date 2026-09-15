import { beforeEach, describe, expect, it, vi } from "vitest";

import { getServerActionClientIp } from "../getServerActionClientIp";

const { headersMock } = vi.hoisted(() => ({
  headersMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

describe("getServerActionClientIp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("TC-01. x-real-ip가 존재하면 해당 값을 반환한다", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        "x-real-ip": "1.2.3.4",
      }),
    );

    await expect(getServerActionClientIp()).resolves.toBe("1.2.3.4");
  });

  it("TC-02. x-real-ip 앞뒤 공백을 제거한다", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        "x-real-ip": "  1.2.3.4  ",
      }),
    );

    await expect(getServerActionClientIp()).resolves.toBe("1.2.3.4");
  });

  it("TC-03. 두 헤더가 모두 존재하면 x-real-ip를 우선한다", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        "x-real-ip": "1.2.3.4",
        "x-forwarded-for": "9.9.9.9",
      }),
    );

    await expect(getServerActionClientIp()).resolves.toBe("1.2.3.4");
  });

  it("TC-04. x-real-ip가 없으면 x-forwarded-for를 반환한다", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        "x-forwarded-for": "5.6.7.8",
      }),
    );

    await expect(getServerActionClientIp()).resolves.toBe("5.6.7.8");
  });

  it("TC-05. x-forwarded-for 앞뒤 공백을 제거한다", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        "x-forwarded-for": "  5.6.7.8  ",
      }),
    );

    await expect(getServerActionClientIp()).resolves.toBe("5.6.7.8");
  });

  it('TC-06. 두 헤더 모두 없으면 "unknown"을 반환한다', async () => {
    headersMock.mockResolvedValue(new Headers());

    await expect(getServerActionClientIp()).resolves.toBe("unknown");
  });

  it('TC-07. 두 헤더가 빈 문자열이면 "unknown"을 반환한다', async () => {
    headersMock.mockResolvedValue(
      new Headers({
        "x-real-ip": "",
        "x-forwarded-for": "",
      }),
    );

    await expect(getServerActionClientIp()).resolves.toBe("unknown");
  });

  it("TC-08. x-real-ip가 공백뿐이면 x-forwarded-for를 사용한다", async () => {
    headersMock.mockResolvedValue(
      new Headers({
        "x-real-ip": "   ",
        "x-forwarded-for": "5.6.7.8",
      }),
    );

    await expect(getServerActionClientIp()).resolves.toBe("5.6.7.8");
  });
});
