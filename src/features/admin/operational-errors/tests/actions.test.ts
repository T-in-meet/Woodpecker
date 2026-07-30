import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { OPERATIONAL_ERROR_STATUS } from "@/features/operational-errors/constants";

import { updateOperationalErrorStatus } from "../actions";

const {
  insertMock,
  maybeSingleMock,
  neqMock,
  requireAdminMock,
  selectEqMock,
  selectMock,
  updateEqMock,
  updateMock,
} = vi.hoisted(() => ({
  insertMock: vi.fn(),
  maybeSingleMock: vi.fn(),
  neqMock: vi.fn(),
  requireAdminMock: vi.fn(),
  selectEqMock: vi.fn(),
  selectMock: vi.fn(),
  updateEqMock: vi.fn(),
  updateMock: vi.fn(),
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
    insertMock.mockReset();
    selectMock.mockReset();
    selectEqMock.mockReset();
    neqMock.mockReset();
    maybeSingleMock.mockReset();
    updateMock.mockReset();
    updateEqMock.mockReset();

    requireAdminMock.mockResolvedValue("admin-user-id");

    selectMock.mockReturnValue({
      eq: selectEqMock,
    });

    const selectBuilder = {
      eq: selectEqMock,
      maybeSingle: maybeSingleMock,
      neq: neqMock,
    };

    selectEqMock.mockReturnValue(selectBuilder);
    neqMock.mockReturnValue(selectBuilder);

    maybeSingleMock.mockResolvedValue({
      data: {
        fingerprint: "fingerprint",
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

    expect(selectMock).toHaveBeenCalledWith("fingerprint, status");
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
      data: null,
      error: null,
    });
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        fingerprint: "fingerprint",
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

  it("상태가 같고 메모만 있으면 처리 이력만 추가한다", async () => {
    const result = await updateOperationalErrorStatus(
      "error-id",
      OPERATIONAL_ERROR_STATUS.OPEN,
      "조사 내용 추가",
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
    expect(insertMock).toHaveBeenCalledWith({
      changed_by: "admin-user-id",
      from_status: OPERATIONAL_ERROR_STATUS.OPEN,
      note: "조사 내용 추가",
      operational_error_id: "error-id",
      to_status: OPERATIONAL_ERROR_STATUS.OPEN,
    });
  });

  it("상태와 메모가 모두 없으면 변경을 거부한다", async () => {
    const result = await updateOperationalErrorStatus(
      "error-id",
      OPERATIONAL_ERROR_STATUS.OPEN,
      "",
    );

    expect(result).toEqual({
      message: "변경할 상태 또는 처리 메모를 입력해주세요.",
      ok: false,
    });
    expect(updateMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it("처리 메모가 최대 길이를 넘으면 변경을 거부한다", async () => {
    const result = await updateOperationalErrorStatus(
      "error-id",
      OPERATIONAL_ERROR_STATUS.RESOLVED,
      "a".repeat(2001),
    );

    expect(result).toEqual({
      message: "처리 메모는 2,000자 이하로 입력해주세요.",
      ok: false,
    });
    expect(selectMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("같은 fingerprint의 OPEN 오류가 있으면 재오픈을 거부한다", async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        fingerprint: "fingerprint",
        status: OPERATIONAL_ERROR_STATUS.RESOLVED,
      },
      error: null,
    });
    maybeSingleMock.mockResolvedValueOnce({
      data: { id: "duplicate-id" },
      error: null,
    });

    const result = await updateOperationalErrorStatus(
      "error-id",
      OPERATIONAL_ERROR_STATUS.OPEN,
      "재오픈",
    );

    expect(result).toEqual({
      message:
        "같은 오류가 이미 재발해 미해결 항목으로 추적 중입니다. 새 항목에서 처리해주세요.",
      ok: false,
    });
    expect(selectEqMock).toHaveBeenCalledWith("fingerprint", "fingerprint");
    expect(selectEqMock).toHaveBeenCalledWith(
      "status",
      OPERATIONAL_ERROR_STATUS.OPEN,
    );
    expect(neqMock).toHaveBeenCalledWith("id", "error-id");
    expect(updateMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
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
