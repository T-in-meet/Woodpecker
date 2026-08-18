import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 지정한 사용자가 관리자 권한을 가졌는지 확인합니다.
 *
 * service role 클라이언트로 profile role을 조회하며,
 * 조회 실패 또는 ADMIN이 아닌 경우 false를 반환합니다.
 *
 * @param userId 확인할 사용자 ID
 * @returns 관리자 여부
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  const adminClient = createAdminClient();

  const { data: profile, error } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error) {
    return false;
  }

  return profile?.role === "ADMIN";
}
