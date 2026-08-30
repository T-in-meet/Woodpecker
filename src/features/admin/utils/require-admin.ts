import "server-only";

import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * 현재 로그인한 사용자가 관리자 권한을 가졌는지 확인합니다.
 *
 * 인증된 사용자가 없거나 인증 조회에 실패하면 UnauthorizedError를 발생시키고,
 * profile 조회에 실패하거나 ADMIN이 아닌 경우 ForbiddenError를 발생시킵니다.
 *
 * @returns 관리자 사용자 ID
 * @throws {UnauthorizedError} 로그인하지 않았거나 인증 조회에 실패한 경우
 * @throws {ForbiddenError} 관리자 권한이 없거나 profile 조회에 실패한 경우
 */
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new UnauthorizedError();
  }

  const adminClient = createAdminClient();

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  return user.id;
}
