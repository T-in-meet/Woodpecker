import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * 비로그인 사용자 전용 인증 페이지 접근 제어
 *
 * - session 없음: 접근 허용
 * - session 있음: mypage로 이동
 */
export async function requireGuestPage() {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session) {
    redirect(ROUTES.MYPAGE);
  }
}
