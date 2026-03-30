// TODO: 인메모리 구현 — 서버리스/멀티 인스턴스 환경에서는 Redis 등 외부 저장소로 교체 필요

export type RateLimitResult = {
  allowed: boolean;
};

export type WindowEntry = {
  count: number;
  windowStart: number;
};

const WINDOW_MS = 60 * 1000;

export function checkLimit(
  store: Map<string, WindowEntry>,
  key: string,
  limit: number,
): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= limit) {
    return false;
  }

  entry.count += 1;
  return true;
}
