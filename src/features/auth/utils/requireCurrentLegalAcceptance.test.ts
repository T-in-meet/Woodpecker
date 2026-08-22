import { beforeEach, describe, expect, it, vi } from "vitest";

const getLegalAcceptanceRequiredPathMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("@/features/auth/lib/userAgreements", () => ({
  getLegalAcceptanceRequiredPath: getLegalAcceptanceRequiredPathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { requireCurrentLegalAcceptance } from "./requireCurrentLegalAcceptance";

describe("requireCurrentLegalAcceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("최신 법적 이벤트가 있으면 서비스 작업을 허용한다", async () => {
    getLegalAcceptanceRequiredPathMock.mockResolvedValue(null);

    await requireCurrentLegalAcceptance("user-id", "/notes");

    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("최신 법적 이벤트가 없으면 검증된 원래 경로와 함께 재확인 페이지로 보낸다", async () => {
    getLegalAcceptanceRequiredPathMock.mockResolvedValue(
      "/agreements?redirect=%2Fnotes",
    );

    await requireCurrentLegalAcceptance("user-id", "/notes");

    expect(redirectMock).toHaveBeenCalledWith("/agreements?redirect=%2Fnotes");
  });
});
