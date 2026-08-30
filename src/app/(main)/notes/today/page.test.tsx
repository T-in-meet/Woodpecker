import { beforeEach, describe, expect, it, vi } from "vitest";

const REDIRECT_ERROR = new Error("NEXT_REDIRECT");

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import TodayReviewPage from "./page";

describe("TodayReviewPage", () => {
  beforeEach(() => {
    redirectMock.mockReset();
    redirectMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
  });

  it("오늘 복습할 노트 보기로 redirect한다", () => {
    expect(() => TodayReviewPage()).toThrow(REDIRECT_ERROR);
    expect(redirectMock).toHaveBeenCalledWith("/notes?view=due");
  });
});
