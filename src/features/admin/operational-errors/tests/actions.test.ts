import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { OPERATIONAL_ERROR_STATUS } from "@/features/operational-errors/constants";

import { updateOperationalErrorStatus } from "../actions";

const {
  insertMock,
  maybeSingleMock,
  requireAdminMock,
  revalidatePathMock,
  selectEqMock,
  selectMock,
  updateEqMock,
  updateMock,
} = vi.hoisted(() => ({
  insertMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  requireAdminMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  selectEqMock: vi.fn(),
  selectMock: vi.fn(),
  updateEqMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: vi.fn(() => ({
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
    revalidatePathMock.mockReset();
    insertMock.mockReset();
    selectMock.mockReset();
    selectEqMock.mockReset();
    maybeSingleMock.mockReset();
    updateMock.mockReset();
    updateEqMock.mockReset();

    requireAdminMock.mockResolvedValue("admin-user-id");

    selectMock.mockReturnValue({
      eq: selectEqMock,
    });

    selectEqMock.mockReturnValue({
      maybeSingle: maybeSingleMock,
    });

    maybeSingleMock.mockResolvedValue({
      data: {
        status: OPERATIONAL_ERROR_STATUS.OPEN,
      },
      error: null,
    });

    updateMock.mockReturnValue({
      eq: updateEqMock,
    });

    updateEqMock.mockResolvedValue({
      error: null,
    });

    insertMock.mockResolvedValue({
      error: null,
    });
  });

  it("sets resolved fields when closing an operational error", async () => {
    const result = await updateOperationalErrorStatus(
      "error-id",
      OPERATIONAL_ERROR_STATUS.RESOLVED,
      "배포 후 정상화 확인",
    );

    expect(result).toEqual({ ok: true });

    expect(selectMock).toHaveBeenCalledWith("status");
    expect(selectEqMock).toHaveBeenCalledWith("id", "error-id");
    expect(maybeSingleMock).toHaveBeenCalledOnce();

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution_note: "배포 후 정상화 확인",
        resolved_at: expect.any(String),
        resolved_by: "admin-user-id",
        status: OPERATIONAL_ERROR_STATUS.RESOLVED,
      }),
    );

    expect(updateEqMock).toHaveBeenCalledWith("id", "error-id");

    expect(insertMock).toHaveBeenCalledWith({
      changed_by: "admin-user-id",
      from_status: OPERATIONAL_ERROR_STATUS.OPEN,
      note: "배포 후 정상화 확인",
      operational_error_id: "error-id",
      to_status: OPERATIONAL_ERROR_STATUS.RESOLVED,
    });
  });

  it("clears resolved fields when reopening an operational error", async () => {
    maybeSingleMock.mockResolvedValue({
      data: {
        status: OPERATIONAL_ERROR_STATUS.RESOLVED,
      },
      error: null,
    });

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

    expect(updateEqMock).toHaveBeenCalledWith("id", "error-id");

    expect(insertMock).toHaveBeenCalledWith({
      changed_by: "admin-user-id",
      from_status: OPERATIONAL_ERROR_STATUS.RESOLVED,
      note: "다시 확인",
      operational_error_id: "error-id",
      to_status: OPERATIONAL_ERROR_STATUS.OPEN,
    });
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

    expect(selectMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });
});
