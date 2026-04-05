import {
  checkLimit,
  RateLimitResult,
  WindowEntry,
} from "@/features/auth/uitils/rateLimit.utils";

const EMAIL_LIMIT = 5;

const emailStore = new Map<string, WindowEntry>();

export function resetResendRateLimitStore(): void {
  emailStore.clear();
}

export async function checkResendRateLimit(
  email: string,
): Promise<RateLimitResult> {
  const allowed = checkLimit(emailStore, email, EMAIL_LIMIT);
  return { allowed };
}
