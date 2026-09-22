import { beforeEach, describe, expect, it, vi } from "vitest";

const abortSignalMock = vi.fn();
const upsertMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: fromMock,
  })),
}));

import { createAdminClient } from "@/lib/supabase/admin";

import { recordCurrentLegalAcceptances } from "./userAgreements";

describe("recordCurrentLegalAcceptances", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    fromMock.mockReturnValue({
      upsert: upsertMock,
    });
    upsertMock.mockReturnValue({
      abortSignal: abortSignalMock,
      error: null,
    });
    abortSignalMock.mockResolvedValue({ error: null });
  });

  it("현재 버전의 세 법적 이벤트를 중복 없이 기록한다", async () => {
    await recordCurrentLegalAcceptances("user-id", "email");

    // 일반 agreements 경로의 기본 계약에는 OTP 전용 timeout signal을 강제하지 않는다.
    expect(vi.mocked(createAdminClient)).toHaveBeenCalledWith();
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
    expect(abortSignalMock).not.toHaveBeenCalled();
  });

  it("signal이 지정되면 해당 upsert query에 abortSignal을 연결한다", async () => {
    const signal = new AbortController().signal;

    await recordCurrentLegalAcceptances("user-id", "email", { signal });

    expect(vi.mocked(createAdminClient)).toHaveBeenCalledWith();
    expect(abortSignalMock).toHaveBeenCalledTimes(1);
    expect(abortSignalMock).toHaveBeenCalledWith(signal);
  });

  it("upsert 실패 시 에러를 전파한다", async () => {
    const error = new Error("upsert failed");
    upsertMock.mockReturnValue({ error });

    await expect(
      recordCurrentLegalAcceptances("user-id", "oauth"),
    ).rejects.toBe(error);
  });
});
