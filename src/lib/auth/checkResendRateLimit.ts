export type RateLimitResult = {
  allowed: boolean;
};

const EMAIL_LIMIT = 5;
const WINDOW_MS = 60 * 1000;

type WindowEntry = {
  count: number;
  windowStart: number;
};

const emailStore = new Map<string, WindowEntry>();

function checkLimit(
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

export function resetResendRateLimitStore(): void {
  emailStore.clear();
}

export async function checkResendRateLimit(
  email: string,
): Promise<RateLimitResult> {
  const allowed = checkLimit(emailStore, email, EMAIL_LIMIT);
  return { allowed };
}
