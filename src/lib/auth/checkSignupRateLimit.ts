import {
  checkLimit,
  RateLimitResult,
  WindowEntry,
} from "@/lib/auth/rateLimitUtils";

const IP_LIMIT = 10;
const EMAIL_LIMIT = 5;

const ipStore = new Map<string, WindowEntry>();
const emailStore = new Map<string, WindowEntry>();

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
