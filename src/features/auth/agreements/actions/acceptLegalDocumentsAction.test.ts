import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.hoisted(() => vi.fn());
const recordCurrentLegalAcceptancesMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
);

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
  })),
}));
vi.mock("@/features/auth/lib/userAgreements", () => ({
  recordCurrentLegalAcceptances: recordCurrentLegalAcceptancesMock,
}));

import { acceptLegalDocumentsAction } from "./acceptLegalDocumentsAction";

function makeCompleteFormData() {
  const formData = new FormData();
  formData.set("termsOfService", "on");
  formData.set("privacyPolicyAcknowledged", "on");
  formData.set("age14OrOlder", "on");
  return formData;
}

describe("acceptLegalDocumentsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: "user-id",
          email: "user@example.com",
          email_confirmed_at: "2026-08-01T00:00:00.000Z",
        },
      },
    });
    recordCurrentLegalAcceptancesMock.mockResolvedValue(undefined);
  });

  it("세 확인 중 하나라도 없으면 기록하지 않는다", async () => {
    const formData = makeCompleteFormData();
    formData.delete("age14OrOlder");

    const state = await acceptLegalDocumentsAction("/notes", {}, formData);

    expect(state.error).toContain("만 14세 이상 확인");
    expect(recordCurrentLegalAcceptancesMock).not.toHaveBeenCalled();
  });

  it("인증된 사용자의 현재 버전 세 이벤트를 기록하고 검증된 경로로 이동한다", async () => {
    await expect(
      acceptLegalDocumentsAction("/notes", {}, makeCompleteFormData()),
    ).rejects.toThrow("REDIRECT:/notes");

    expect(recordCurrentLegalAcceptancesMock).toHaveBeenCalledWith(
      "user-id",
      "agreements_page",
    );
  });
});
