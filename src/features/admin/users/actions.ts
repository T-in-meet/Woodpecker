"use server";

import { revalidatePath } from "next/cache";

import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";

import { requireAdmin } from "../utils/require-admin";
import type { UserRole } from "./types/user-list";

/** 관리자 화면에서 변경할 수 있는 사용자 역할 */
const USER_ROLES = ["USER", "ADMIN"] as const satisfies readonly UserRole[];

export type UpdateUserRoleResult =
  | { ok: true }
  | { message: string; ok: false };

/**
 * 전달된 값이 관리자 사용자 페이지에서 지원하는 역할인지 확인합니다.
 *
 * @param value 확인할 역할 값
 * @returns 지원하는 사용자 역할이면 true
 */
function isUserRole(value: string): value is UserRole {
  return USER_ROLES.some((role) => role === value);
}

/**
 * 관리자가 지정한 사용자의 역할을 변경합니다.
 *
 * 현재 로그인한 관리자는 자신의 역할을 변경할 수 없습니다.
 * 기존 역할과 요청 역할이 같으면 불필요한 DB 업데이트 없이 성공을 반환합니다.
 *
 * @param userId 역할을 변경할 사용자 ID
 * @param role 새로 적용할 역할
 * @returns 역할 변경 결과
 */
export async function updateUserRole(
  userId: string,
  role: string,
): Promise<UpdateUserRoleResult> {
  /** 관리자 권한을 확인하고 현재 관리자 ID를 조회합니다. */
  const adminUserId = await requireAdmin();

  /** 잘못된 사용자 ID로 DB 조회가 수행되지 않도록 차단합니다. */
  if (userId.trim().length === 0) {
    return {
      message: "사용자 정보가 올바르지 않습니다.",
      ok: false,
    };
  }

  /** 허용되지 않은 역할 값은 DB 조회 전에 차단합니다. */
  if (!isUserRole(role)) {
    return {
      message: "역할 값이 올바르지 않습니다.",
      ok: false,
    };
  }

  /**
   * 현재 관리자가 자신의 역할을 변경하면 관리자 페이지 접근 권한을
   * 즉시 잃을 수 있으므로 역할 변경을 허용하지 않습니다.
   */
  if (userId === adminUserId) {
    return {
      message: "자신의 역할은 변경할 수 없습니다.",
      ok: false,
    };
  }

  const supabase = createAdminClient();

  /** 대상 사용자의 존재 여부와 현재 역할을 확인합니다. */
  const { data: currentUser, error: currentUserError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (currentUserError || !currentUser || !isUserRole(currentUser.role)) {
    return {
      message: "사용자를 찾을 수 없습니다.",
      ok: false,
    };
  }

  /** 기존 역할과 요청 역할이 같으면 불필요한 업데이트를 생략합니다. */
  if (currentUser.role === role) {
    return { ok: true };
  }

  /** 대상 사용자의 역할을 요청받은 값으로 변경합니다. */
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (error) {
    return {
      message: "사용자 역할 변경에 실패했습니다.",
      ok: false,
    };
  }

  /** 서버에서 직접 조회하는 관리자 사용자 목록 캐시를 갱신합니다. */
  revalidatePath(ROUTES.ADMIN.USERS);

  return { ok: true };
}
