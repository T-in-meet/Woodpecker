/**
 * Request Eligibility System — unified rate limit store
 *
 * Design:
 * - IP-based: single window for burst suppression
 * - Email-based (2-tier): short window (immediate retry suppression) + long window (user-level account rate limit)
 * - Both signup and resend share the same email store (user-scoped, not API-scoped)
 *
 * State Model:
 * - ipStore: Map<ip, WindowEntry>
 * - emailStore: Map<normalizedEmail, EmailEligibilityEntry>
 *
 * EmailEligibilityEntry separates immediate retry suppression from user-level rate limiting:
 * - shortWindow: null | WindowEntry (cooldown replacement — suppress immediate retries)
 * - longWindow: null | WindowEntry (shared signup + resend account-level limit)
 */

/**
 * Rate limit window state
 * - count: number of requests in current window
 * - windowStart: timestamp (ms) when window started
 */
export type WindowEntry = {
  count: number;
  windowStart: number;
};

/**
 * Email-based eligibility state (2-tier)
 * - shortWindow: immediate retry suppression (replaces cooldown timestamp model)
 * - longWindow: user-level account rate limit shared across signup/resend
 */
export type EmailEligibilityEntry = {
  shortWindow: WindowEntry | null;
  longWindow: WindowEntry | null;
};

/**
 * IP-based rate limit store (in-memory)
 * - Key: IP address (string as-is)
 * - Value: WindowEntry
 */
export const ipStore = new Map<string, WindowEntry>();

/**
 * Email-based eligibility store (in-memory)
 * - Key: lowercase-normalized email
 * - Value: EmailEligibilityEntry (short + long windows)
 *
 * Design rationale:
 * - Lazy initialization: entry created only when request is allowed
 * - Safe access via ?? { shortWindow: null, longWindow: null } default
 * - Full replace on update: always set new objects, no direct mutation
 */
export const emailStore = new Map<string, EmailEligibilityEntry>();

/**
 * Reset eligibility stores (test isolation)
 *
 * Clears both IP and email state. Used between test cases to prevent cross-test contamination.
 */
export function resetEligibilityStore(): void {
  ipStore.clear();
  emailStore.clear();
}
