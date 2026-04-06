import {
  checkLimit,
  RateLimitResult,
  WindowEntry,
} from "@/features/auth/uitils/rateLimit.utils";

/**
 * 이메일 인증 재전송 허용 횟수 제한
 *
 * - 동일 이메일 기준으로 일정 시간(window) 내 최대 요청 횟수
 */
const EMAIL_LIMIT = 5;

/**
 * 이메일별 rate limit 상태 저장소 (in-memory)
 *
 * key: email
 * value: WindowEntry (요청 횟수 + 시작 시간)
 *
 * ⚠️ 주의사항
 * - 서버 메모리에 저장되므로 서버리스/멀티 인스턴스 환경에서는 공유되지 않음
 * - 실제 운영 환경에서는 Redis 등 외부 저장소로 대체 필요
 */
const emailStore = new Map<string, WindowEntry>();

/**
 * rate limit 저장소 초기화 (테스트 용도)
 *
 * - 각 테스트 케이스 간 상태 격리를 위해 사용
 */
export function resetResendRateLimitStore(): void {
  emailStore.clear();
}

/**
 * 이메일 인증 재전송 rate limit 검사
 *
 * @param email 요청 대상 이메일
 * @returns { allowed: boolean }
 *
 * 동작:
 * - checkLimit을 통해 현재 요청이 허용되는지 판단
 * - 내부적으로 window 기반 카운팅 수행
 */
export async function checkResendRateLimit(
  email: string,
): Promise<RateLimitResult> {
  /**
   * 요청 허용 여부 계산
   */
  const allowed = checkLimit(emailStore, email, EMAIL_LIMIT);

  return { allowed };
}
