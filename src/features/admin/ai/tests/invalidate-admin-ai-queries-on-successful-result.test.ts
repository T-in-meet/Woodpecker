import { beforeEach, describe, expect, it, vi } from "vitest";

const { invalidateAdminAiQueriesMock } = vi.hoisted(() => ({
  invalidateAdminAiQueriesMock: vi.fn(),
}));

vi.mock("../utils/invalidate-admin-ai-queries", () => ({
  invalidateAdminAiQueries: invalidateAdminAiQueriesMock,
}));

import { invalidateAdminAiQueriesOnSuccessfulResult } from "../utils/invalidate-admin-ai-queries-on-successful-result";

describe("invalidateAdminAiQueriesOnSuccessfulResult", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("성공 결과이면 관리자 AI Query 캐시를 무효화한다", () => {
    const queryClient = {
      queryClientId: "admin-ai-query-client",
    };

    invalidateAdminAiQueriesOnSuccessfulResult(queryClient as never, {
      ok: true,
    });

    expect(invalidateAdminAiQueriesMock).toHaveBeenCalledWith(queryClient);
  });

  it("실패 결과이면 관리자 AI Query 캐시를 무효화하지 않는다", () => {
    const queryClient = {
      queryClientId: "admin-ai-query-client",
    };

    const result = invalidateAdminAiQueriesOnSuccessfulResult(
      queryClient as never,
      {
        message: "입력 오류",
        ok: false,
      },
    );

    expect(result).toBeUndefined();
    expect(invalidateAdminAiQueriesMock).not.toHaveBeenCalled();
  });
});
