import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 이메일로 사용자 조회 (Admin API 사용)
 *
 * - Supabase Auth의 admin.listUsers()는 이메일 단건 조회 API를 제공하지 않음
 * - 따라서 페이지네이션을 순회하며 전체 유저 목록에서 이메일을 탐색
 *
 * @param email 조회할 사용자 이메일
 * @returns
 *  - 존재하는 경우: { email, email_confirmed_at }
 *  - 존재하지 않는 경우: null
 *
 * ⚠️ 주의사항
 * - O(N) 탐색 (전체 유저 수에 비례) → 사용자 수 많아지면 성능 이슈
 * - 서버리스/대규모 환경에서는 DB 테이블(profile 등) 기반 조회로 대체 권장
 */
export async function getUserByEmail(
  email: string,
): Promise<{ email: string; email_confirmed_at: string | null } | null> {
  /**
   * 관리자 권한 Supabase 클라이언트
   * - 일반 client로는 admin API 사용 불가
   */
  const supabase = createAdminClient();

  /**
   * 페이지네이션 설정
   * - Supabase listUsers는 page 기반 pagination 사용
   */
  let page = 1;
  const perPage = 1000;

  while (true) {
    /**
     * 현재 페이지 사용자 목록 조회
     */
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    /**
     * API 호출 실패 시 에러 전파
     * - 상위에서 에러 처리 (로그/응답 매핑)
     */
    if (error) {
      throw error;
    }

    /**
     * 현재 페이지에서 이메일 일치 사용자 탐색
     */
    const user = data.users.find((u) => u.email === email);

    /**
     * 사용자 발견 시 필요한 필드만 반환
     * - email: fallback으로 입력값 사용
     * - email_confirmed_at: null 가능
     */
    if (user) {
      return {
        email: user.email ?? email,
        email_confirmed_at: user.email_confirmed_at ?? null,
      };
    }

    /**
     * 마지막 페이지 판단
     * - 현재 페이지 데이터 수가 perPage보다 작으면 더 이상 데이터 없음
     */
    if (data.users.length < perPage) {
      return null;
    }

    /**
     * 다음 페이지로 이동
     */
    page += 1;
  }
}
