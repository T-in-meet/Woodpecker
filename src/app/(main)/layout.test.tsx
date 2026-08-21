import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.hoisted(() => vi.fn());
const getLegalAcceptanceStatusMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
);
const headersMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("@/lib/supabase/getUser", () => ({ getUser: getUserMock }));
vi.mock("@/features/auth/lib/userAgreements", () => ({
  getLegalAcceptanceStatus: getLegalAcceptanceStatusMock,
}));
vi.mock("@/components/layout/Header", () => ({
  Header: vi.fn(() => null),
  HeaderSkeleton: vi.fn(() => null),
}));

import MainLayout from "./layout";

describe("MainLayout 법적 문서 게이트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue(new Headers({ "x-pathname": "/notes" }));
  });

  it("로그인하지 않은 사용자는 로그인으로 보낸다", async () => {
    getUserMock.mockResolvedValue(null);

    await expect(MainLayout({ children: <div>content</div> })).rejects.toThrow(
      "REDIRECT:/login",
    );
  });

  it("시행 후 최신 기록이 없으면 원래 경로를 포함한 재확인 화면으로 보낸다", async () => {
    getUserMock.mockResolvedValue({
      id: "user-id",
      email: "user@example.com",
      email_confirmed_at: "2026-08-01T00:00:00.000Z",
    });
    getLegalAcceptanceStatusMock.mockResolvedValue({
      canAccessService: false,
    });

    await expect(MainLayout({ children: <div>content</div> })).rejects.toThrow(
      "REDIRECT:/agreements?redirect=%2Fnotes",
    );
  });

  it("최신 기록이 있으면 메인 콘텐츠를 렌더링한다", async () => {
    getUserMock.mockResolvedValue({
      id: "user-id",
      email: "user@example.com",
      email_confirmed_at: "2026-08-01T00:00:00.000Z",
    });
    getLegalAcceptanceStatusMock.mockResolvedValue({
      canAccessService: true,
    });

    const result = await MainLayout({ children: <div>content</div> });

    expect(result).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
