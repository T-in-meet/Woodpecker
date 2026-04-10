/**
 * Request Eligibility System — single entry point
 *
 * Unified decision authority for rate limiting across signup and resend.
 *
 * Design:
 * - Single entry point: checkRequestEligibility(route, ip, email)
 * - Atomic: decision + state update in one function
 * - AND evaluation: all three conditions must pass
 * - User-scoped: email state shared between signup/resend
 * - Observability: logRequestEligibilityBlocked on blocked requests only
 *
 * State Model:
 * - IP rate limit: single window, strong burst suppression
 * - Email short window: immediate retry suppression (cooldown replacement)
 * - Email long window: user-level account rate limit (signup + resend shared)
 */

import {
  emailStore,
  ipStore,
  resetEligibilityStore,
  type WindowEntry,
} from "./requestEligibilityStore";

/**
 * IP-based rate limit
 * - Burst suppression: reject multiple requests from same IP in short window
 */
export const IP_LIMIT = 10;
export const IP_WINDOW_MS = 60 * 1000; // 1 minute

/**
 * Email-based rate limit: short window
 * - Immediate retry suppression (replaces cooldown timestamp model)
 * - Much shorter than long window
 * [Reason: EMAIL_SHORT_LIMIT = 1 to prevent rapid-fire requests (cooldown behavior).
 *  Short window blocks any request within 30sec of the previous request.]
 */
export const EMAIL_SHORT_LIMIT = 1;
export const EMAIL_SHORT_WINDOW_MS = 30 * 1000; // 30 seconds

/**
 * Email-based rate limit: long window
 * - User-level account rate limit shared across signup and resend
 * - Prevents sustained attacks against single account
 */
export const EMAIL_LONG_LIMIT = 5;
export const EMAIL_LONG_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Check request eligibility — single decision authority
 *
 * @param route - "signup" or "resend" (used for logging to identify which API blocked)
 * @param ip - client IP address (used as-is for IP store)
 * @param email - email address (will be lowercased for store key)
 *
 * @returns { allowed: boolean }
 *
 * Flow:
 * 1. Read phase: evaluate all conditions WITHOUT updating state
 *    - ipOk: within IP limit?
 *    - emailShortOk: within email short window limit?
 *    - emailLongOk: within email long window limit?
 *
 * 2. Decision: AND all conditions
 *    - allowed = ipOk && emailShortOk && emailLongOk
 *
 * 3. Write phase: update state ONLY if allowed=true
 *    - If blocked: log the rejection, do NOT modify state
 *    - If allowed: atomically update IP and email stores
 *
 * Design constraints:
 * - Lazy initialization: email store entries created only on allowed=true
 * - Safe access: use ?? defaultEntry to avoid undefined access
 * - Full replace: always create new WindowEntry/EmailEligibilityEntry objects
 * - Immutable update: nextWindow() returns new objects, no direct mutation
 * - State pollution prevention: blocked requests never touch state
 * - Email normalization: email is lowercased for consistent store key
 */
export function checkRequestEligibility(
  route: "signup" | "resend",
  ip: string,
  email: string,
): { allowed: boolean } {
  const now = Date.now();
  const normalizedEmail = email.toLowerCase();

  // ============================================================================
  // 1. Read phase — evaluate all conditions without state updates
  // ============================================================================

  const ipEntry = ipStore.get(ip);
  const emailEntry = emailStore.get(normalizedEmail) ?? {
    shortWindow: null,
    longWindow: null,
  };

  const ipOk = withinLimit(ipEntry, IP_LIMIT, IP_WINDOW_MS, now);
  const emailShortOk = withinLimit(
    emailEntry.shortWindow,
    EMAIL_SHORT_LIMIT,
    EMAIL_SHORT_WINDOW_MS,
    now,
  );
  const emailLongOk = withinLimit(
    emailEntry.longWindow,
    EMAIL_LONG_LIMIT,
    EMAIL_LONG_WINDOW_MS,
    now,
  );

  // ============================================================================
  // 2. AND decision
  // ============================================================================

  const allowed = ipOk && emailShortOk && emailLongOk;

  // ============================================================================
  // 3. Write phase — update state ONLY if allowed
  // ============================================================================

  if (!allowed) {
    // Blocked: log rejection but DO NOT modify state
    logRequestEligibilityBlocked({
      route,
      ip,
      email: normalizedEmail,
      ipOk,
      emailShortOk,
      emailLongOk,
      now,
    });

    return { allowed: false };
  }

  // Allowed: atomically update both stores
  const nextIpEntry = nextWindow(ipEntry, IP_WINDOW_MS, now);
  ipStore.set(ip, nextIpEntry);

  const nextEmailEntry = {
    shortWindow: nextWindow(emailEntry.shortWindow, EMAIL_SHORT_WINDOW_MS, now),
    longWindow: nextWindow(emailEntry.longWindow, EMAIL_LONG_WINDOW_MS, now),
  };
  emailStore.set(normalizedEmail, nextEmailEntry);

  return { allowed: true };
}

/**
 * Helper: evaluate if request is within limit (read-only, no state update)
 *
 * @param entry - existing WindowEntry or undefined
 * @param limit - max requests allowed in window
 * @param windowMs - window duration
 * @param now - current timestamp
 *
 * @returns true if request should be allowed
 *
 * Logic:
 * - No entry: allow (first request)
 * - Entry expired: allow (window reset)
 * - Count < limit: allow
 * - Count >= limit: deny
 */
function withinLimit(
  entry: WindowEntry | null | undefined,
  limit: number,
  windowMs: number,
  now: number,
): boolean {
  if (!entry) {
    return true;
  }

  if (now - entry.windowStart >= windowMs) {
    return true;
  }

  return entry.count < limit;
}

/**
 * Helper: compute next window state (immutable)
 *
 * @param entry - existing WindowEntry or null
 * @param windowMs - window duration
 * @param now - current timestamp
 *
 * @returns new WindowEntry object
 *
 * Design:
 * - No entry or expired: start new window with count=1
 * - Active window: increment count
 * - Always return NEW object (no mutation of input)
 */
function nextWindow(
  entry: WindowEntry | null | undefined,
  windowMs: number,
  now: number,
): WindowEntry {
  if (!entry || now - entry.windowStart >= windowMs) {
    // New window
    return {
      count: 1,
      windowStart: now,
    };
  }

  // Active window: increment
  return {
    count: entry.count + 1,
    windowStart: entry.windowStart,
  };
}

/**
 * Log request eligibility rejection (internal use only)
 *
 * Called only when allowed=false. Records:
 * - Which API blocked (signup vs resend)
 * - Which conditions failed (ipOk, emailShortOk, emailLongOk)
 * - Masked identifiers (never raw IP/email)
 *
 * This function is internal to checkRequestEligibility and should not be
 * exposed or called directly from routes. All logging happens inside
 * checkRequestEligibility to prevent log duplication and ensure
 * consistent observability.
 */
function logRequestEligibilityBlocked(params: {
  route: "signup" | "resend";
  ip: string;
  email: string;
  ipOk: boolean;
  emailShortOk: boolean;
  emailLongOk: boolean;
  now: number;
}): void {
  const maskedIp = maskIp(params.ip);
  const maskedEmail = maskEmail(params.email);

  console.log(
    JSON.stringify({
      event: "request_eligibility_blocked",
      route: params.route,
      maskedIp,
      maskedEmail,
      ipOk: params.ipOk,
      emailShortOk: params.emailShortOk,
      emailLongOk: params.emailLongOk,
      timestamp: new Date(params.now).toISOString(),
    }),
  );
}

/**
 * Mask IP address for logging (hide last octet)
 * Example: 192.168.1.100 → 192.168.1.***
 */
function maskIp(ip: string): string {
  const parts = ip.split(".");
  if (parts.length === 4) {
    parts[3] = "***";
    return parts.join(".");
  }
  // IPv6 or other format: mask last part after colon
  if (ip.includes(":")) {
    const colonIndex = ip.lastIndexOf(":");
    return ip.substring(0, colonIndex + 1) + "***";
  }
  return "***";
}

/**
 * Mask email for logging (hide local part)
 * Example: user@example.com → ***@example.com
 */
function maskEmail(email: string): string {
  const atIndex = email.indexOf("@");
  if (atIndex > 0) {
    return "***" + email.substring(atIndex);
  }
  return "***";
}

// Export for testing
export { resetEligibilityStore };
