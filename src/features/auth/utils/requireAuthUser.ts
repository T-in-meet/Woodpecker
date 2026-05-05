import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";
import { getUser } from "@/lib/supabase/getUser";

type Options = {
  redirectTo?: string;
};

/**
 * 인증된 사용자만 접근 가능한 페이지 보호
 *
 * 동작:
 * - user 있음: 접근 허용
 * - user 없음 또는 getUser 실패: redirect
 *
 * redirect 대상:
 * - options.redirectTo가 있으면 해당 경로
 * - 없으면 기본값 ROUTES.LOGIN 사용
 */
export async function requireAuthUser(options?: Options): Promise<void> {
  const redirectTo = options?.redirectTo ?? ROUTES.LOGIN;

  try {
    const user = await getUser();

    if (!user) {
      redirect(redirectTo);
    }
  } catch {
    redirect(redirectTo);
  }
}
