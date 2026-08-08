import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * 현재 로그인한 사용자가 관리자 권한을 가졌는지 확인합니다.
 *
 * 관리자 기능은 service role 클라이언트를 사용해 RLS를 우회할 수 있으므로,
 * service role 작업 전에 반드시 이 함수를 호출해야 합니다.
 *
 * @returns 현재 관리자 사용자의 ID
 * @throws 로그인하지 않은 경우 Unauthorized
 * @throws 관리자 권한이 없는 경우 Forbidden
 */
export async function requireAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Unauthorized");
  }

  const adminClient = createAdminClient();
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "ADMIN") {
    throw new Error("Forbidden");
  }

  return user.id;
}
