import {
  checkLimit,
  RateLimitResult,
  WindowEntry,
} from "@/features/auth/utils/rateLimit.utils";

/**
 * IP 기준 요청 제한 횟수
 * - 동일 IP에서의 회원가입 시도 제한
 */
export const IP_LIMIT = 10;

/**
 * IP 기준 rate limit window
 * - burst abuse를 빠르게 차단하기 위해 짧게 유지
 */
export const IP_WINDOW_MS = 60 * 1000;

/**
 * 이메일 기준 요청 제한 횟수
 * - 동일 이메일로의 회원가입 시도 제한
 */
export const EMAIL_LIMIT = 5;

/**
 * 이메일 기준 rate limit window
 * - 동일 계정 대상 반복 시도를 더 긴 시간축에서 완만하게 제한
 */
export const EMAIL_WINDOW_MS = 15 * 60 * 1000;

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
 * 회원가입 IP rate limit 검사
 *
 * @param ip 요청 IP
 * @returns { allowed: boolean }
 *
 * 설계 의도:
 * - 요청 본문 파싱/validation 이전에도 적용 가능한 조기 차단 버킷
 * - malformed/invalid 요청 flood까지 포함해 짧고 강하게 제한
 */
export async function checkSignupIpRateLimit(
  ip: string,
): Promise<RateLimitResult> {
  return {
    allowed: checkLimit(ipStore, ip, IP_LIMIT, IP_WINDOW_MS),
    limit: IP_LIMIT,
    windowMs: IP_WINDOW_MS,
  };
}

/**
 * 회원가입 이메일 rate limit 검사
 *
 * @param email 정규화된 요청 이메일
 * @returns { allowed: boolean }
 *
 * 설계 의도:
 * - validation 이후, 정규화된 이메일 기준으로 적용하는 계정 단위 제한
 * - 짧은 burst보다 중기적인 반복 시도를 억제하기 위해 더 긴 window를 사용
 */
export async function checkSignupEmailRateLimit(
  email: string,
): Promise<RateLimitResult> {
  return {
    allowed: checkLimit(emailStore, email, EMAIL_LIMIT, EMAIL_WINDOW_MS),
    limit: EMAIL_LIMIT,
    windowMs: EMAIL_WINDOW_MS,
  };
}

/**
 * 회원가입 rate limit 검사 (임시 호환용)
 *
 * 현재 signup route가 단일 함수 호출 구조를 사용하고 있어,
 * 단계형 정책으로 route를 옮기기 전까지는 기존 진입점을 유지한다.
 *
 * 주의:
 * - 새 정책의 정석 사용법은 checkSignupIpRateLimit / checkSignupEmailRateLimit를
 *   요청 흐름 단계별로 각각 호출하는 것이다.
 * - 이 호환 함수는 rollback을 수행하지 않는다.
 */
export async function checkSignupRateLimit(
  ip: string,
  email: string,
): Promise<RateLimitResult> {
  const ipResult = await checkSignupIpRateLimit(ip);
  if (!ipResult.allowed) return ipResult;

  return checkSignupEmailRateLimit(email);
}
