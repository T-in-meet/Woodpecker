import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.hoisted(() => vi.fn());
const getLegalAcceptanceStatusMock = vi.hoisted(() => vi.fn());
const isLegalRevisionEffectiveMock = vi.hoisted(() => vi.fn());
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
/* 전체 교체가 아니라 부분 mock으로 둔다. 이 레이아웃이 직접 쓰는 건 아래 셋뿐이지만,
   Footer가 같은 모듈의 LEGAL_CONTACT를 읽는 것처럼 트리 안에서 다른 export를 쓰는
   컴포넌트가 늘어날 수 있다. 그때마다 이 stub에 항목을 더하지 않도록 원본을 깔아 둔다. */
vi.mock("@/lib/constants/legal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants/legal")>()),
  formatLegalDate: (date: string) => date,
  isLegalRevisionEffective: isLegalRevisionEffectiveMock,
  LEGAL_EFFECTIVE_DATE: "2026-09-20",
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
    isLegalRevisionEffectiveMock.mockReturnValue(false);
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
      isComplete: false,
    });

    await expect(MainLayout({ children: <div>content</div> })).rejects.toThrow(
      "REDIRECT:/agreements?redirect=%2Fnotes",
    );
  });

  it("시행 전 최신 기록이 없으면 개정 안내를 표시한다", async () => {
    getUserMock.mockResolvedValue({
      id: "user-id",
      email: "user@example.com",
      email_confirmed_at: "2026-08-01T00:00:00.000Z",
    });
    getLegalAcceptanceStatusMock.mockResolvedValue({
      canAccessService: true,
      isComplete: false,
    });

    render(await MainLayout({ children: <div>content</div> }));

    expect(
      screen.getByRole("complementary", { name: "법적 문서 개정 안내" }),
    ).toBeInTheDocument();
  });

  it("시행 전 최신 기록이 있으면 개정 안내 없이 메인 콘텐츠를 렌더링한다", async () => {
    getUserMock.mockResolvedValue({
      id: "user-id",
      email: "user@example.com",
      email_confirmed_at: "2026-08-01T00:00:00.000Z",
    });
    getLegalAcceptanceStatusMock.mockResolvedValue({
      canAccessService: true,
      isComplete: true,
    });

    const result = await MainLayout({ children: <div>content</div> });
    render(result);

    expect(
      screen.queryByRole("complementary", { name: "법적 문서 개정 안내" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("content")).toBeInTheDocument();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
