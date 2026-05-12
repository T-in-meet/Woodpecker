// 여러 서버 컴포넌트에서 auth.getUser() 중복 호출을 방지하는 React.cache() 래퍼 — 삭제 시 Header·mypage에서 요청당 auth 호출이 3회 이상 발생함
import { cache } from "react";

import { createServerComponentClient } from "./server";

export const getUser = cache(async () => {
  const supabase = await createServerComponentClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (error.status) {
      console.error("[getUser] auth error:", error.message);
    }
    return null;
  }
  return data.user;
});
