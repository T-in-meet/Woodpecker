import {
  checkLimit,
  RateLimitResult,
  WindowEntry,
} from "@/features/auth/utils/rateLimit.utils";

/**
 * IP 기준 요청 제한 횟수
 * - 동일 IP에서의 회원가입 시도 제한
 */
const IP_LIMIT = 10;

/**
 * 이메일 기준 요청 제한 횟수
 * - 동일 이메일로의 회원가입 시도 제한
 */
const EMAIL_LIMIT = 5;

/**
 * IP별 rate limit 상태 저장소 (in-memory)
 */
const ipStore = new Map<string, WindowEntry>();

/**
 * 이메일별 rate limit 상태 저장소 (in-memory)
 */
const emailStore = new Map<string, WindowEntry>();

/**
 * rate limit 저장소 초기화 (테스트용)
 *
 * - 테스트 간 상태 격리를 위해 사용
 */
export function resetRateLimitStores(): void {
  ipStore.clear();
  emailStore.clear();
}

/**
 * 회원가입 rate limit 검사
 *
 * @param ip 요청 IP
 * @param email 요청 이메일
 * @returns { allowed: boolean }
 *
 * 동작 순서:
 * 1. IP 제한 체크
 * 2. 이메일 제한 체크
 * 3. 이메일 제한 실패 시 IP 카운트 롤백
 *
 * 설계 의도:
 * - IP + 이메일 이중 제한
 * - email 차단 시 IP 카운트까지 증가하면 과도한 차단 발생 → 롤백 처리
 */
export async function checkSignupRateLimit(
  ip: string,
  email: string,
): Promise<RateLimitResult> {
  /**
   * 1. IP 기준 제한 체크
   */
  const ipAllowed = checkLimit(ipStore, ip, IP_LIMIT);

  if (!ipAllowed) {
    return { allowed: false };
  }

  /**
   * 2. 이메일 기준 제한 체크
   */
  const emailAllowed = checkLimit(emailStore, email, EMAIL_LIMIT);

  if (!emailAllowed) {
    /**
     * 이메일 차단 시 IP 카운트 롤백
     *
     * 이유:
     * - 이메일 기준으로 차단된 요청까지 IP 제한에 포함되면
     *   정상 사용자까지 IP 차단될 가능성 있음
     */
    const ipEntry = ipStore.get(ip);

    if (ipEntry && ipEntry.count > 0) {
      ipEntry.count -= 1;
    }

    return { allowed: false };
  }

  /**
   * 모든 조건 통과
   */
  return { allowed: true };
}
