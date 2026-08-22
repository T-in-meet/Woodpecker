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

  it("현재 버전의 세 법적 이벤트를 중복 없이 기록한다", async () => {
    await ensureUserAgreement("user-id", "email");

    expect(fromMock).toHaveBeenCalledWith("user_legal_acceptances");
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "terms_accepted",
          document_version: "2026-09-20",
          user_id: "user-id",
          source: "email",
        }),
        expect.objectContaining({
          event_type: "privacy_notice_acknowledged",
          document_version: "2026-09-20",
          user_id: "user-id",
          source: "email",
        }),
        expect.objectContaining({
          event_type: "age_14_confirmed",
          document_version: "2026-09-20",
          user_id: "user-id",
          source: "email",
        }),
      ]),
      {
        ignoreDuplicates: true,
        onConflict: "user_id,event_type,document_version",
      },
    );
  });

  it("upsert 실패 시 에러를 전파한다", async () => {
    const error = new Error("upsert failed");
    upsertMock.mockResolvedValue({ error });

    await expect(ensureUserAgreement("user-id", "oauth")).rejects.toBe(error);
  });
});
