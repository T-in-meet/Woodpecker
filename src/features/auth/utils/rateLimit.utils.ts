/**
 * 슬라이딩 윈도우 로그 기반 rate limit
 *
 * 타임스탬프 배열에서 만료된 항목을 제거하여 유효한 요청만 계산한다.
 * window_start = now - windowMs
 * valid_timestamp = timestamp >= window_start
 */

/**
 * 슬라이딩 윈도우 평가 결과
 *
 * - allowed: limit 기준 허용 여부
 * - pruned: 만료 제거 후 유효 타임스탬프 배열
 * - next: append 정책이 적용된 다음 상태 배열
 */
export type SlidingWindowEvaluationResult = {
  allowed: boolean;
  pruned: number[];
  next: number[];
};

/**
 * 윈도우 내 만료된 타임스탬프 제거
 *
 * @param timestamps 타임스탬프 배열
 * @param windowMs 윈도우 크기 (ms)
 * @param now 현재 시각 (ms)
 * @returns 윈도우 내 유효한 타임스탬프만 포함한 새 배열
 *
 * 알고리즘:
 * - window_start = now - windowMs
 * - 조건: timestamp >= window_start (즉, timestamp >= now - windowMs)
 * - 입력 배열은 불변 (새 배열 반환)
 *
 * 예시:
 * - now=1000, windowMs=500 → window_start=500
 * - timestamps=[100, 600, 900]
 * - 결과: [600, 900] (100은 < 500이므로 제거)
 */
export function pruneExpired(
  timestamps: number[],
  windowMs: number,
  now: number,
): number[] {
  const windowStart = now - windowMs;
  return timestamps.filter((timestamp) => timestamp >= windowStart);
}

/**
 * 슬라이딩 윈도우 평가 + append 결정을 한 번에 수행한다.
 *
 * 책임:
 * - prune
 * - evaluate(limit)
 * - append-on-allow
 *
 * @param timestamps 기존 타임스탬프 배열
 * @param limit 허용 개수
 * @param windowMs 윈도우 크기
 * @param now 현재 시각
 * @param options.appendOnAllow 허용 시 now append 여부 (기본 true)
 */
export function evaluateSlidingWindow(
  timestamps: number[],
  limit: number,
  windowMs: number,
  now: number,
  options?: { appendOnAllow?: boolean },
): SlidingWindowEvaluationResult {
  const pruned = pruneExpired(timestamps, windowMs, now);
  const allowed = pruned.length < limit;
  const appendOnAllow = options?.appendOnAllow ?? true;

  const next = allowed && appendOnAllow ? [...pruned, now] : pruned;

  return {
    allowed,
    pruned,
    next,
  };
}
