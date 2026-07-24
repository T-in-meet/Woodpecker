import { createAdminClient } from "@/lib/supabase/admin";

/**
 * canonical_email으로 사용자 조회
 *
 * 설계 변경 (v2):
 * - 기존: Supabase admin.listUsers() O(N) 스캔 (페이지네이션으로 전체 유저 순회)
 * - 변경: profiles.canonical_email 인덱스 기반 O(1) 조회
 *
 * 흐름:
 * 1. profiles 테이블에서 canonical_email로 id 조회 (service role key)
 * 2. 해당 id로 auth.users에서 email_confirmed_at 조회 (admin API)
 *
 * @param canonicalEmail 정규화된 이메일 (signup/resend에서 canonicalizeEmail() 결과)
 * @returns
 *  - 존재하는 경우: { id, email: auth.users의 원본 이메일, email_confirmed_at }
 *  - 존재하지 않는 경우: null
 *
 * ⚠️ 주의사항
 * - 입력값은 반드시 canonicalizeEmail() 결과여야 함
 * - profiles 테이블에 canonical_email이 존재해야 함 (migration 필수)
 * - email_confirmed_at은 Supabase Auth가 관리하는 필드
 */
export async function getUserByEmail(canonicalEmail: string): Promise<{
  id: string;
  email: string | null;
  email_confirmed_at: string | null;
} | null> {
  const adminClient = createAdminClient();

  /**
   * 1단계: profiles 테이블에서 canonical_email로 사용자 id 조회
   * - canonical_email은 UNIQUE index로 빠른 조회 (O(1))
   * - null 값은 UNIQUE 제약에서 제외되므로 maybeSingle() 안전
   */
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("canonical_email", canonicalEmail)
    .maybeSingle();

  /**
   * profiles 조회 실패 시 에러 전파
   */
  if (profileError) {
    throw profileError;
  }

  /**
   * 프로필 없으면 사용자 미존재
   *
   * 운영 전제:
   * - canonical_email 도입 시점에 기존 사용자 데이터는 삭제 후 재가입으로 전환한다.
   * - 따라서 canonical_email이 비어 있는 legacy profiles를 여기서 fallback 조회하지 않는다.
   * - legacy 데이터 유지 배포가 필요해지면 backfill migration과 함께 fallback 정책을 재검토해야 한다.
   */
  if (!profile) {
    return null;
  }

  /**
   * 2단계: auth.users에서 해당 id로 사용자 조회
   * - email_confirmed_at을 포함하여 이메일 인증 상태 확인
   */
  const { data: userData, error: userError } =
    await adminClient.auth.admin.getUserById(profile.id);

  /**
   * auth.users 조회 실패 시 에러 전파
   */
  if (userError) {
    throw userError;
  }

  /**
   * 사용자 없으면 일관성 위반 (profiles 존재하는데 auth.users 없음)
   * 실제로는 FK 제약으로 불가능하지만 방어 처리
   */
  if (!userData.user) {
    return null;
  }

  /**
   * 사용자 정보 반환
   * - id: user_agreements 같은 user_id 기반 후속 처리에 사용
   * - email: auth.users의 raw email (사용자 입력 보존)
   * - email_confirmed_at: 이메일 인증 상태
   */
  return {
    id: userData.user.id,
    email: userData.user.email ?? null,
    email_confirmed_at: userData.user.email_confirmed_at ?? null,
  };
}
