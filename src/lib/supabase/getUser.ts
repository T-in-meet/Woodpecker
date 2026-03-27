// 여러 서버 컴포넌트에서 auth.getUser() 중복 호출을 방지하는 React.cache() 래퍼 — 삭제 시 Header·mypage에서 요청당 auth 호출이 3회 이상 발생함
import { cache } from "react";

import { createClient } from "./server";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) console.error("[getUser]", error.message);
  return data.user;
});
