import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("../../utils/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

type ProfileQueryResult = {
  data: { role: string } | null;
  error: { message: string } | null;
};

type UpdateQueryResult = {
  error: { message: string } | null;
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
  const single = vi.fn().mockResolvedValue(profileResult);
  const selectEq = vi.fn(() => ({
    single,
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
    select,
    selectEq,
    single,
    update,
    updateEq,
  };
}

describe("updateUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockResolvedValue("admin-user-id");
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
  });

  it("지원하지 않는 역할 값은 DB 조회 전에 차단합니다.", async () => {
    const result = await updateUserRole("target-user-id", "OWNER");

    expect(result).toEqual({
      message: "역할 값이 올바르지 않습니다.",
      ok: false,
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("현재 관리자는 자신의 역할을 변경할 수 없습니다.", async () => {
    const result = await updateUserRole("admin-user-id", "USER");

    expect(result).toEqual({
      message: "자신의 역할은 변경할 수 없습니다.",
      ok: false,
    });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("대상 사용자를 찾을 수 없으면 실패합니다.", async () => {
    const supabase = createSupabaseMock({
      profileResult: {
        data: null,
        error: { message: "not found" },
      },
    });

    const result = await updateUserRole("target-user-id", "ADMIN");

    expect(result).toEqual({
      message: "사용자를 찾을 수 없습니다.",
      ok: false,
    });
    expect(supabase.update).not.toHaveBeenCalled();
  });

  it("저장된 역할 값이 올바르지 않으면 실패합니다.", async () => {
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
    expect(supabase.update).not.toHaveBeenCalled();
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

    expect(supabase.update).toHaveBeenCalledWith({
      role: "ADMIN",
    });
    expect(supabase.updateEq).toHaveBeenCalledWith("id", "target-user-id");

    expect(revalidatePath).toHaveBeenCalledWith(ROUTES.ADMIN.USERS);
  });

  it("역할 변경에 실패하면 오류 결과를 반환합니다.", async () => {
    createSupabaseMock({
      profileResult: {
        data: { role: "USER" },
        error: null,
      },
      updateResult: {
        error: { message: "update failed" },
      },
    });

    const result = await updateUserRole("target-user-id", "ADMIN");

    expect(result).toEqual({
      message: "사용자 역할 변경에 실패했습니다.",
      ok: false,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
