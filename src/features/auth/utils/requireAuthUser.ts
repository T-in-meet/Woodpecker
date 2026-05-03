import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";
import { getUser } from "@/lib/supabase/getUser";

/**
 * 인증된 사용자만 접근 가능한 페이지 보호
 *
 * 정책:
 * - user 있음: 접근 허용
 * - user 없음: 로그인 페이지로 이동
 * - getUser 검증 실패: 로그인 페이지로 이동
 */
export async function requireAuthUser(): Promise<void> {
  try {
    const user = await getUser();

    if (!user) {
      redirect(ROUTES.LOGIN);
    }
  } catch {
    redirect(ROUTES.LOGIN);
  }
}
