// TODO: 인메모리 구현 — 서버리스/멀티 인스턴스 환경에서는 Redis 등 외부 저장소로 교체 필요

/**
 * rate limit 결과 타입
 *
 * - allowed: 요청 허용 여부
 */
export type RateLimitResult = {
  allowed: boolean;
  limit?: number | undefined;
  windowMs?: number | undefined;
};

/**
 * rate limit 윈도우 상태
 *
 * - count: 현재 윈도우 내 요청 횟수
 * - windowStart: 윈도우 시작 시각 (timestamp, ms)
 */
export type WindowEntry = {
  count: number;
  windowStart: number;
};

/**
 * 기본 rate limit 윈도우 (1분)
 */
export const DEFAULT_WINDOW_MS = 60 * 1000;

/**
 * rate limit 검사 함수 (슬라이딩 윈도우 기반)
 *
 * @param store key별 rate limit 상태 저장소
 * @param key rate limit 기준 키 (ip, email 등)
 * @param limit 허용 최대 요청 횟수
 * @param windowMs 시간 윈도우 (기본: 60초)
 *
 * @returns 요청 허용 여부 (true: 허용, false: 차단)
 *
 * 동작:
 * 1. 현재 시각 기준으로 window 확인
 * 2. 새 윈도우거나 entry가 없으면 초기화
 * 3. limit 초과 시 차단
 * 4. 그렇지 않으면 count 증가 후 허용
 *
 * 특징:
 * - 간단한 fixed window 방식
 * - key별 독립적인 rate limit 관리
 *
 * ⚠️ 주의사항:
 * - 메모리 기반이므로 서버 재시작 시 초기화됨
 * - 멀티 인스턴스 환경에서는 정확한 제한 불가
 */
export function checkLimit(
  store: Map<string, WindowEntry>,
  key: string,
  limit: number,
  windowMs: number = DEFAULT_WINDOW_MS,
): boolean {
  /**
   * 현재 시각
   */
  const now = Date.now();

  /**
   * 기존 entry 조회
   */
  const entry = store.get(key);

  /**
   * 1. entry가 없거나 window가 만료된 경우
   * → 새로운 window 시작
   */
  if (!entry || now - entry.windowStart >= windowMs) {
    store.set(key, { count: 1, windowStart: now });
    return true;
  }

  /**
   * 2. limit 초과 시 요청 차단
   */
  if (entry.count >= limit) {
    return false;
  }

  /**
   * 3. count 증가 후 허용
   */
  entry.count += 1;

  return true;
}
