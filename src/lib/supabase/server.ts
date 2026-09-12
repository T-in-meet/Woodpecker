import {
  createServerClient,
  DEFAULT_COOKIE_OPTIONS,
  isChunkLike,
} from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database.types";

/**
 * 현재 Supabase 프로젝트의 기본 Auth storage key를 반환합니다.
 *
 * 프로젝트에서는 cookieOptions.name이나 auth.storageKey를 별도로 지정하지 않으므로
 * Supabase JS의 기본 규칙인 `sb-<project-ref>-auth-token`을 그대로 사용합니다.
 */
function getSupabaseAuthStorageKey(): string {
  const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
  const projectRef = supabaseUrl.hostname.split(".")[0];

  return `sb-${projectRef}-auth-token`;
}

/**
 * 현재 요청 컨텍스트에 저장된 Supabase Auth session cookie를 제거합니다.
 *
 * OAuth callback에서 exchangeCodeForSession()이 세션 쿠키를 기록한 뒤
 * 원격 signOut()이 실패하면 Supabase 내부에서는 로컬 session 제거까지
 * 진행되지 않을 수 있습니다.
 *
 * 이 경우 현재 브라우저가 해당 세션을 계속 사용하지 못하도록
 * 기본 Auth storage key와 그 chunk cookie만 만료시킵니다.
 *
 * 다른 애플리케이션 cookie나 OAuth intent cookie는 제거하지 않습니다.
 */
export async function clearSupabaseAuthSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  const storageKey = getSupabaseAuthStorageKey();

  const authCookies = cookieStore
    .getAll()
    .filter(({ name }) => isChunkLike(name, storageKey));

  authCookies.forEach(({ name }) => {
    cookieStore.set(name, "", {
      ...DEFAULT_COOKIE_OPTIONS,
      maxAge: 0,
    });
  });
}

// Server Action / Route Handler용 — 쿠키 쓰기 실패 시 예외 전파
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
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );
}

// Server Component용 — 읽기 전용 컨텍스트에서 쿠키 쓰기 실패를 무시
// middleware에서 세션 갱신을 담당하므로 정상 동작에 영향 없음
export async function createServerComponentClient() {
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
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서 쿠키 쓰기 불가 에러 무시
          }
        },
      },
    },
  );
}
