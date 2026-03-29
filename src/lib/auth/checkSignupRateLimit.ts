export type RateLimitResult = {
  allowed: boolean;
};

const IP_LIMIT = 10;
const EMAIL_LIMIT = 5;
const WINDOW_MS = 60 * 1000;

type WindowEntry = {
  count: number;
  windowStart: number;
};

const ipStore = new Map<string, WindowEntry>();
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

export function resetRateLimitStores(): void {
  ipStore.clear();
  emailStore.clear();
}

export async function checkSignupRateLimit(
  ip: string,
  email: string,
): Promise<RateLimitResult> {
  const ipAllowed = checkLimit(ipStore, ip, IP_LIMIT);
  if (!ipAllowed) return { allowed: false };

  const emailAllowed = checkLimit(emailStore, email, EMAIL_LIMIT);
  if (!emailAllowed) {
    // IP 카운트를 되돌림 (email 차단 시 IP 카운트 롤백)
    const ipEntry = ipStore.get(ip);
    if (ipEntry && ipEntry.count > 0) {
      ipEntry.count -= 1;
    }
    return { allowed: false };
  }

  return { allowed: true };
}
