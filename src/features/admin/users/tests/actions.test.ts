import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  OPERATIONAL_ERROR_CODES,
  OPERATIONAL_ERROR_FEATURES,
  OPERATIONAL_ERROR_OPERATIONS,
  OPERATIONAL_ERROR_SEVERITY,
  OPERATIONAL_ERROR_STAGES,
} from "@/features/operational-errors/constants";
import { reportOperationalError } from "@/features/operational-errors/report";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../../utils/require-admin";
import { updateUserRole } from "../actions";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/features/operational-errors/report", () => ({
  reportOperationalError: vi.fn(),
}));

vi.mock("../../utils/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

type SupabaseError = {
  message: string;
};

type ProfileQueryResult = {
  data: { role: string } | null;
  error: SupabaseError | null;
};

type UpdateQueryResult = {
  error: SupabaseError | null;
};

/**
 * 사용자 역할 조회와 수정에 필요한 Supabase 부분 mock을 생성합니다.
 */
function createSupabaseMock({
  profileResult = {
    data: { role: "USER" },
    error: null,
  },
  updateResult = {
    error: null,
  },
}: {
  profileResult?: ProfileQueryResult;
  updateResult?: UpdateQueryResult;
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue(profileResult);
  const selectEq = vi.fn(() => ({
    maybeSingle,
  }));
  const select = vi.fn(() => ({
    eq: selectEq,
  }));

  const updateEq = vi.fn().mockResolvedValue(updateResult);
  const update = vi.fn(() => ({
    eq: updateEq,
  }));

  const from = vi.fn(() => ({
    select,
    update,
  }));

  const client = { from };

  vi.mocked(createAdminClient).mockReturnValue(
    client as unknown as ReturnType<typeof createAdminClient>,
  );

  return {
    from,
    maybeSingle,
    select,
    selectEq,
    update,
    updateEq,
  };
}

describe("updateUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue("admin-user-id");
    vi.mocked(reportOperationalError).mockResolvedValue({
      id: "operational-error-id",
      ok: true,
      recorded: "created",
    });
  });

  it("관리자 권한을 확인합니다.", async () => {
    createSupabaseMock();

    await updateUserRole("target-user-id", "ADMIN");

    expect(requireAdmin).toHaveBeenCalledTimes(1);
  });

  it("사용자 ID가 비어 있으면 DB를 조회하지 않습니다.", async () => {
    const result = await updateUserRole("   ", "ADMIN");

    expect(result).toEqual({
      message: "사용자 정보가 올바르지 않습니다.",
      ok: false,
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(reportOperationalError).not.toHaveBeenCalled();
  });

  it("지원하지 않는 역할 값은 DB 조회 전에 차단합니다.", async () => {
    const result = await updateUserRole("target-user-id", "OWNER");

    expect(result).toEqual({
      message: "역할 값이 올바르지 않습니다.",
      ok: false,
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(reportOperationalError).not.toHaveBeenCalled();
  });

  it("현재 관리자는 자신의 역할을 변경할 수 없습니다.", async () => {
    const result = await updateUserRole("admin-user-id", "USER");

    expect(result).toEqual({
      message: "자신의 역할은 변경할 수 없습니다.",
      ok: false,
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(reportOperationalError).not.toHaveBeenCalled();
  });

  it("대상 사용자 조회에 실패하면 운영 오류를 기록합니다.", async () => {
    const loadError = { message: "load failed" };
    const supabase = createSupabaseMock({
      profileResult: {
        data: null,
        error: loadError,
      },
    });

    const result = await updateUserRole("target-user-id", "ADMIN");

    expect(result).toEqual({
      message: "사용자 정보를 확인하지 못했습니다.",
      ok: false,
    });

    expect(reportOperationalError).toHaveBeenCalledWith({
      actorUserId: "admin-user-id",
      context: {
        requestedRole: "ADMIN",
        targetUserId: "target-user-id",
      },
      error: loadError,
      errorCode: OPERATIONAL_ERROR_CODES.ADMIN_USER_ROLE_TARGET_LOAD_FAILED,
      feature: OPERATIONAL_ERROR_FEATURES.ADMIN_USERS,
      message: "역할 변경 대상 사용자 조회에 실패했습니다.",
      operation: OPERATIONAL_ERROR_OPERATIONS.UPDATE_ADMIN_USER_ROLE,
      severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
      stage: OPERATIONAL_ERROR_STAGES.TARGET_USER_LOAD,
      userId: "target-user-id",
    });

    expect(supabase.update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("대상 사용자가 존재하지 않으면 운영 오류 없이 실패합니다.", async () => {
    const supabase = createSupabaseMock({
      profileResult: {
        data: null,
        error: null,
      },
    });

    const result = await updateUserRole("target-user-id", "ADMIN");

    expect(result).toEqual({
      message: "사용자를 찾을 수 없습니다.",
      ok: false,
    });

    expect(reportOperationalError).not.toHaveBeenCalled();
    expect(supabase.update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("저장된 역할 값이 올바르지 않으면 운영 오류 없이 실패합니다.", async () => {
    const supabase = createSupabaseMock({
      profileResult: {
        data: { role: "OWNER" },
        error: null,
      },
    });

    const result = await updateUserRole("target-user-id", "ADMIN");

    expect(result).toEqual({
      message: "사용자를 찾을 수 없습니다.",
      ok: false,
    });

    expect(reportOperationalError).not.toHaveBeenCalled();
    expect(supabase.update).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("기존 역할과 요청 역할이 같으면 update를 생략합니다.", async () => {
    const supabase = createSupabaseMock({
      profileResult: {
        data: { role: "ADMIN" },
        error: null,
      },
    });

    const result = await updateUserRole("target-user-id", "ADMIN");

    expect(result).toEqual({ ok: true });
    expect(supabase.update).not.toHaveBeenCalled();
    expect(reportOperationalError).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("사용자 역할을 변경하고 목록 경로를 갱신합니다.", async () => {
    const supabase = createSupabaseMock({
      profileResult: {
        data: { role: "USER" },
        error: null,
      },
    });

    const result = await updateUserRole("target-user-id", "ADMIN");

    expect(result).toEqual({ ok: true });

    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(supabase.select).toHaveBeenCalledWith("role");
    expect(supabase.selectEq).toHaveBeenCalledWith("id", "target-user-id");
    expect(supabase.maybeSingle).toHaveBeenCalledTimes(1);

    expect(supabase.update).toHaveBeenCalledWith({
      role: "ADMIN",
    });
    expect(supabase.updateEq).toHaveBeenCalledWith("id", "target-user-id");

    expect(reportOperationalError).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith(ROUTES.ADMIN.USERS);
  });

  it("역할 변경에 실패하면 운영 오류를 기록합니다.", async () => {
    const updateError = { message: "update failed" };

    createSupabaseMock({
      profileResult: {
        data: { role: "USER" },
        error: null,
      },
      updateResult: {
        error: updateError,
      },
    });

    const result = await updateUserRole("target-user-id", "ADMIN");

    expect(result).toEqual({
      message: "사용자 역할 변경에 실패했습니다.",
      ok: false,
    });

    expect(reportOperationalError).toHaveBeenCalledWith({
      actorUserId: "admin-user-id",
      context: {
        previousRole: "USER",
        requestedRole: "ADMIN",
        targetUserId: "target-user-id",
      },
      error: updateError,
      errorCode: OPERATIONAL_ERROR_CODES.ADMIN_USER_ROLE_UPDATE_FAILED,
      feature: OPERATIONAL_ERROR_FEATURES.ADMIN_USERS,
      message: "관리자 사용자 역할 변경에 실패했습니다.",
      operation: OPERATIONAL_ERROR_OPERATIONS.UPDATE_ADMIN_USER_ROLE,
      severity: OPERATIONAL_ERROR_SEVERITY.ERROR,
      stage: OPERATIONAL_ERROR_STAGES.USER_ROLE_UPDATE,
      userId: "target-user-id",
    });

    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
