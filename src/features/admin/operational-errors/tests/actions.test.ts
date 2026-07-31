import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { OPERATIONAL_ERROR_STATUS } from "@/features/operational-errors/constants";

import { updateOperationalErrorStatus } from "../actions";

const { recordAdminOperationalErrorMock, requireAdminMock, rpcMock } =
  vi.hoisted(() => ({
    recordAdminOperationalErrorMock: vi.fn(),
    requireAdminMock: vi.fn(),
    rpcMock: vi.fn(),
  }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: rpcMock,
  }),
}));

vi.mock("@/features/admin/utils/require-admin", () => ({
  requireAdmin: requireAdminMock,
}));

vi.mock("../utils/record-admin-operational-error", () => ({
  recordAdminOperationalError: recordAdminOperationalErrorMock,
}));

describe("updateOperationalErrorStatus", () => {
  beforeEach(() => {
    requireAdminMock.mockReset();
    recordAdminOperationalErrorMock.mockReset();
    rpcMock.mockReset();

    requireAdminMock.mockResolvedValue("admin-user-id");
    rpcMock.mockResolvedValue({
      data: "OK",
      error: null,
    });
  });

  it("updates status and history through one RPC", async () => {
    const result = await updateOperationalErrorStatus(
      "error-id",
      OPERATIONAL_ERROR_STATUS.RESOLVED,
      " 배포 후 정상화 확인 ",
    );

    expect(result).toEqual({ ok: true });
    expect(rpcMock).toHaveBeenCalledWith(
      "update_operational_error_status_with_history",
      {
        p_admin_user_id: "admin-user-id",
        p_operational_error_id: "error-id",
        p_resolution_note: "배포 후 정상화 확인",
        p_status: OPERATIONAL_ERROR_STATUS.RESOLVED,
      },
    );
  });

  it("returns the existing no changes message from the RPC result", async () => {
    rpcMock.mockResolvedValue({
      data: "NO_CHANGES",
      error: null,
    });

    const result = await updateOperationalErrorStatus(
      "error-id",
      OPERATIONAL_ERROR_STATUS.OPEN,
      "",
    );

    expect(result).toEqual({
      message: "변경할 상태 또는 처리 메모를 입력해주세요.",
      ok: false,
    });
  });

  it("returns the existing duplicate open message from the RPC result", async () => {
    rpcMock.mockResolvedValue({
      data: "OPEN_DUPLICATE",
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
  });

  it("returns not found when the RPC cannot find the operational error", async () => {
    rpcMock.mockResolvedValue({
      data: "NOT_FOUND",
      error: null,
    });

    const result = await updateOperationalErrorStatus(
      "error-id",
      OPERATIONAL_ERROR_STATUS.RESOLVED,
      "처리",
    );

    expect(result).toEqual({
      message: "운영 오류를 찾을 수 없습니다.",
      ok: false,
    });
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
    expect(rpcMock).not.toHaveBeenCalled();
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

    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("records an admin operational error when the RPC fails", async () => {
    const error = { message: "rpc failed" };
    rpcMock.mockResolvedValue({
      data: null,
      error,
    });

    const result = await updateOperationalErrorStatus(
      "error-id",
      OPERATIONAL_ERROR_STATUS.RESOLVED,
      "처리",
    );

    expect(result).toEqual({
      message: "운영 오류 상태 변경에 실패했습니다.",
      ok: false,
    });
    expect(recordAdminOperationalErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin-user-id",
        error,
        message: "운영 오류 상태 변경과 처리 이력 저장에 실패했습니다.",
      }),
    );
  });
});
