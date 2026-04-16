import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database.types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // NOTE:
            // Server Component에서 createClient()가 호출될 경우
            // Supabase의 세션 갱신 과정에서 cookies.set이 시도되면
            // Next.js가 "Cookies can only be modified in a Server Action or Route Handler"
            // 에러를 발생시킬 수 있다.
            //
            // 현재는 middleware에서 세션 정합성(refresh / cleanup)을 담당하므로
            // 이 경로에서는 쿠키 쓰기 실패를 임시로 무시한다.
            //
            // TODO:
            // 구조적 해결 방안은 팀 미팅 후에 결정한 사항을 따른다
          }
        },
      },
    },
  );
}
