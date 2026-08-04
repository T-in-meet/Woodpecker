import type { User } from "@supabase/supabase-js";

export const PASSWORD_AUTH_PROVIDER = "email";

/**
 * unknown metadata 값을 문자열 배열로 정규화합니다.
 *
 * @param value Supabase app_metadata providers 후보 값
 * @returns 문자열 항목만 포함한 provider 목록
 */
function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Supabase Auth user에서 연결된 인증 provider 목록을 추출합니다.
 *
 * @param user Supabase Auth 사용자
 * @returns app_metadata와 identities에서 확인한 provider 목록
 */
export function getAuthProviders(user: User): string[] {
  const providers = new Set<string>();
  const metadataProviders = toStringArray(user.app_metadata?.["providers"]);
  const metadataProvider = user.app_metadata?.["provider"];

  for (const provider of metadataProviders) {
    providers.add(provider);
  }

  if (typeof metadataProvider === "string") {
    providers.add(metadataProvider);
  }

  for (const identity of user.identities ?? []) {
    if (typeof identity.provider === "string") {
      providers.add(identity.provider);
    }
  }

  return [...providers];
}

/**
 * Supabase Auth user에 이메일/비밀번호 로그인이 연결되어 있는지 확인합니다.
 *
 * @param user Supabase Auth 사용자
 * @returns password provider가 연결되어 있으면 true
 */
export function hasPasswordLogin(user: User): boolean {
  return getAuthProviders(user).includes(PASSWORD_AUTH_PROVIDER);
}
