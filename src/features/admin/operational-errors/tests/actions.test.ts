import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { OPERATIONAL_ERROR_STATUS } from "@/features/operational-errors/constants";

import { updateOperationalErrorStatus } from "../actions";

const {
  eqMock,
  insertMock,
  requireAdminMock,
  revalidatePathMock,
  selectMock,
  singleMock,
  updateMock,
} = vi.hoisted(() => ({
  eqMock: vi.fn(),
  insertMock: vi.fn(),
  requireAdminMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  selectMock: vi.fn(),
  singleMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: vi.fn(() => ({
      eq: eqMock,
      insert: insertMock,
      select: selectMock,
      update: updateMock,
    })),
  }),
}));

vi.mock("@/features/admin/utils/require-admin", () => ({
  requireAdmin: requireAdminMock,
}));

describe("updateOperationalErrorStatus", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    requireAdminMock.mockResolvedValue("admin-user-id");
    revalidatePathMock.mockReset();
    insertMock.mockReset();
    selectMock.mockReset();
    singleMock.mockReset();
    updateMock.mockReset();
    eqMock.mockReset();
    updateMock.mockReturnValue({ eq: eqMock });
    selectMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValueOnce({ single: singleMock });
    eqMock.mockResolvedValueOnce({ error: null });
    singleMock.mockResolvedValue({
      data: { status: OPERATIONAL_ERROR_STATUS.OPEN },
      error: null,
    });
    insertMock.mockResolvedValue({ error: null });
  });

  it("sets resolved fields when closing an operational error", async () => {
    const result = await updateOperationalErrorStatus(
      "error-id",
      OPERATIONAL_ERROR_STATUS.RESOLVED,
      "배포 후 정상화 확인",
    );

    expect(result).toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution_note: "배포 후 정상화 확인",
        resolved_at: expect.any(String),
        resolved_by: "admin-user-id",
        status: OPERATIONAL_ERROR_STATUS.RESOLVED,
      }),
    );
    expect(eqMock).toHaveBeenCalledWith("id", "error-id");
    expect(insertMock).toHaveBeenCalledWith({
      changed_by: "admin-user-id",
      from_status: OPERATIONAL_ERROR_STATUS.OPEN,
      note: "배포 후 정상화 확인",
      operational_error_id: "error-id",
      to_status: OPERATIONAL_ERROR_STATUS.RESOLVED,
    });
  });

  it("clears resolved fields when reopening an operational error", async () => {
    const result = await updateOperationalErrorStatus(
      "error-id",
      OPERATIONAL_ERROR_STATUS.OPEN,
      "다시 확인",
    );

    expect(result).toEqual({ ok: true });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution_note: null,
        resolved_at: null,
        resolved_by: null,
        status: OPERATIONAL_ERROR_STATUS.OPEN,
      }),
    );
  });

  it("rejects an unknown status", async () => {
    const result = await updateOperationalErrorStatus(
      "error-id",
      "REOPENED",
      "",
    );

    expect(result).toEqual({
      message: "상태 값이 올바르지 않습니다.",
      ok: false,
    });
    expect(updateMock).not.toHaveBeenCalled();
  });
});
