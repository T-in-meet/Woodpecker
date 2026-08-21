import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  getLegalAcceptanceStatus,
  LEGAL_ACCEPTANCE_EVENT,
  recordCurrentLegalAcceptances,
} from "../userAgreements";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin");

const queryInMock = vi.fn();
const queryEqMock = vi.fn(() => ({ in: queryInMock }));
const querySelectMock = vi.fn(() => ({ eq: queryEqMock }));
const upsertMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn(() => ({ select: querySelectMock, upsert: upsertMock })),
  } as never);
});

describe("getLegalAcceptanceStatus", () => {
  it("시행 전에는 기록이 없어도 접근을 허용하고 누락 이벤트를 반환한다", async () => {
    queryInMock.mockResolvedValue({ data: [], error: null });

    const status = await getLegalAcceptanceStatus(
      "user-id",
      new Date("2026-09-19T14:59:59.999Z"),
    );

    expect(status.canAccessService).toBe(true);
    expect(status.isComplete).toBe(false);
    expect(status.missingEvents).toEqual([
      LEGAL_ACCEPTANCE_EVENT.terms,
      LEGAL_ACCEPTANCE_EVENT.privacyNotice,
      LEGAL_ACCEPTANCE_EVENT.ageEligibility,
    ]);
  });

  it("시행 시각부터 누락 기록이 있으면 접근을 차단한다", async () => {
    queryInMock.mockResolvedValue({
      data: [{ event_type: "terms_accepted", document_version: "2026-09-20" }],
      error: null,
    });

    const status = await getLegalAcceptanceStatus(
      "user-id",
      new Date("2026-09-19T15:00:00.000Z"),
    );

    expect(status.canAccessService).toBe(false);
    expect(status.missingEvents).toEqual([
      LEGAL_ACCEPTANCE_EVENT.privacyNotice,
      LEGAL_ACCEPTANCE_EVENT.ageEligibility,
    ]);
  });

  it("현재 버전의 세 이벤트가 있으면 접근을 허용한다", async () => {
    queryInMock.mockResolvedValue({
      data: [
        { event_type: "terms_accepted", document_version: "2026-09-20" },
        {
          event_type: "privacy_notice_acknowledged",
          document_version: "2026-09-20",
        },
        { event_type: "age_14_confirmed", document_version: "2026-09-20" },
      ],
      error: null,
    });

    const status = await getLegalAcceptanceStatus("user-id");

    expect(status.isComplete).toBe(true);
    expect(status.canAccessService).toBe(true);
    expect(status.missingEvents).toEqual([]);
  });
});

describe("recordCurrentLegalAcceptances", () => {
  it("서버가 현재 버전의 세 이벤트를 중복 없이 기록한다", async () => {
    upsertMock.mockResolvedValue({ error: null });

    await recordCurrentLegalAcceptances("user-id", "email");

    expect(upsertMock).toHaveBeenCalledOnce();
    expect(upsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "terms_accepted",
          document_version: "2026-09-20",
        }),
        expect.objectContaining({
          event_type: "privacy_notice_acknowledged",
          document_version: "2026-09-20",
        }),
        expect.objectContaining({
          event_type: "age_14_confirmed",
          document_version: "2026-09-20",
        }),
      ]),
      {
        ignoreDuplicates: true,
        onConflict: "user_id,event_type,document_version",
      },
    );
  });
});
