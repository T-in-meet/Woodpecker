/**
 * Password Login / OTP Verify Auth Provider request timeout budget.
 *
 * Context 생성 시점이 아니라 실제 Provider fetch invocation 시점부터 적용한다.
 */
export const AUTH_PROVIDER_TIMEOUT_MS = 10_000;
