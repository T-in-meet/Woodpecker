import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: fromMock,
  })),
}));

import { ensureUserAgreement } from "./userAgreements";

describe("ensureUserAgreement", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fromMock.mockReturnValue({
      upsert: upsertMock,
    });
    upsertMock.mockResolvedValue({ error: null });
  });

  it("기존 약관 source를 덮지 않도록 중복 행을 무시하는 upsert를 사용한다", async () => {
    await ensureUserAgreement("user-id", "email");

    expect(fromMock).toHaveBeenCalledWith("user_agreements");
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-id",
        source: "email",
      }),
      {
        ignoreDuplicates: true,
        onConflict: "user_id",
      },
    );
  });

  it("upsert 실패 시 에러를 전파한다", async () => {
    const error = new Error("upsert failed");
    upsertMock.mockResolvedValue({ error });

    await expect(ensureUserAgreement("user-id", "oauth")).rejects.toBe(error);
  });
});
