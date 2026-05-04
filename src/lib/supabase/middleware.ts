import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import type { Database } from "@/types/database.types";

/**
 * middleware 전용 Supabase client 생성
 *
 * 목적:
 * - middleware에서 session 조회만 수행하기 위한 client
 * - Server Component / Server Action용 createClient와 분리
 *
 * 정책:
 * - cookie는 request 기반으로 읽기만 수행한다
 * - middleware에서는 Supabase cookie write를 수행하지 않는다
 *   (cookie write는 updateSession에서만 처리)
 *
 * 주의:
 * - next/headers 기반 createClient를 middleware에서 사용하지 않는다
 */
function createMiddlewareClient(request: NextRequest) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          /**
           * middleware에서는 cookie write를 수행하지 않는다.
           *
           * 이유:
           * - session refresh 및 cookie 동기화는 updateSession이 담당한다
           * - 접근 제어 단계에서 cookie를 수정하면 책임이 분산된다
           */
        },
      },
    },
  );
}

/**
 * middleware 요청 기반 session 조회
 *
 * 동작:
 * - request cookie를 기반으로 Supabase session을 조회한다
 *
 * 주의:
 * - 반드시 updateSession(request) 호출 이후에 사용해야 한다
 * - session refresh 결과를 반영한 상태에서 조회해야 한다
 */
export async function getSessionFromMiddlewareRequest(request: NextRequest) {
  const supabase = createMiddlewareClient(request);
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}
