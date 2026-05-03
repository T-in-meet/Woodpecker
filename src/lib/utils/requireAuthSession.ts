import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * 인증된 사용자만 접근 가능한 페이지 보호
 *
 * 사용 대상:
 * - /auth/reset-password
 *
 * 정책:
 * - session 있음: 접근 허용
 * - session 없음: 로그인 페이지로 이동
 */
export async function requireAuthSession() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(ROUTES.LOGIN);
  }

  return session;
}
