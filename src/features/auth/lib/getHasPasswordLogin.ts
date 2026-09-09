import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 비밀번호 hash를 노출하지 않고 사용자의 password 로그인 가능 여부를 조회합니다.
 *
 * @param userId 조회할 Supabase Auth 사용자 ID
 * @returns 비어 있지 않은 encrypted_password가 존재하면 true
 */
export async function getHasPasswordLogin(userId: string): Promise<boolean> {
  // auth.users 접근 권한이 제한된 service_role 전용 RPC를 호출합니다.
  const { data, error } = await createAdminClient().rpc("has_password_login", {
    p_user_id: userId,
  });

  // 판정 실패를 비밀번호 미설정으로 오인하지 않도록 오류를 전파합니다.
  if (error) {
    throw error;
  }

  return data;
}
