import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

export const requireOtpResendPage = async () => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  /**
   * 인증이 완료된 사용자는
   * OTP 재전송 페이지 접근 불가
   */
  if (user?.email_confirmed_at) {
    redirect(ROUTES.MYPAGE);
  }
};
