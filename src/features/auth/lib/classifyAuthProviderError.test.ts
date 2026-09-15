import { describe, expect, it } from "vitest";

import {
  classifyAuthProviderError,
  isOtpValidityFailure,
  isPasswordLoginCredentialFailure,
} from "./classifyAuthProviderError";

/**
 * 현재 Supabase Provider 계약을 기준으로 고정한 테스트 fixture.
 *
 * Provider/SDK 계약을 변경할 경우 fixture와 classifier를 함께 검토해야 한다.
 */
const AUTH_PROVIDER_ERROR_FIXTURES = {
  invalidCredentials: {
    status: 400,
    code: "invalid_credentials",
  },
  otpExpired: {
    status: 403,
    code: "otp_expired",
  },
  requestRateLimit: {
    status: 429,
    code: "over_request_rate_limit",
  },
  emailRateLimit: {
    status: 429,
    code: "over_email_send_rate_limit",
  },
  unknown: {
    status: 500,
    code: "unexpected_failure",
  },
} as const;

describe("classifyAuthProviderError", () => {
  it("HTTP 429는 Provider Rate Limit으로 분류한다", () => {
    expect(
      classifyAuthProviderError(
        AUTH_PROVIDER_ERROR_FIXTURES.requestRateLimit,
      ),
    ).toBe("provider_rate_limit");
  });

  it("확정된 request Rate Limit code를 Provider Rate Limit으로 분류한다", () => {
    expect(
      classifyAuthProviderError({
        status: 400,
        code: "over_request_rate_limit",
      }),
    ).toBe("provider_rate_limit");
  });

  it("확정된 email Rate Limit code를 Provider Rate Limit으로 분류한다", () => {
    expect(
      classifyAuthProviderError({
        status: 400,
        code: "over_email_send_rate_limit",
      }),
    ).toBe("provider_rate_limit");
  });

  it("알 수 없는 code는 Provider Error로 분류한다", () => {
    expect(
      classifyAuthProviderError(AUTH_PROVIDER_ERROR_FIXTURES.unknown),
    ).toBe("provider_error");
  });

  it("code가 없고 429도 아니면 Provider Error로 분류한다", () => {
    expect(
      classifyAuthProviderError({
        status: 503,
        code: undefined,
      }),
    ).toBe("provider_error");
  });
});

describe("isPasswordLoginCredentialFailure", () => {
  it("확정된 invalid_credentials fixture만 credential failure로 인정한다", () => {
    expect(
      isPasswordLoginCredentialFailure(
        AUTH_PROVIDER_ERROR_FIXTURES.invalidCredentials,
      ),
    ).toBe(true);
  });

  it("동일 code라도 status가 다르면 credential failure로 추정하지 않는다", () => {
    expect(
      isPasswordLoginCredentialFailure({
        status: 500,
        code: "invalid_credentials",
      }),
    ).toBe(false);
  });

  it("Provider Rate Limit은 credential failure가 아니다", () => {
    expect(
      isPasswordLoginCredentialFailure(
        AUTH_PROVIDER_ERROR_FIXTURES.requestRateLimit,
      ),
    ).toBe(false);
  });
});

describe("isOtpValidityFailure", () => {
  it("확정된 otp_expired fixture를 OTP validity failure로 인정한다", () => {
    expect(
      isOtpValidityFailure(AUTH_PROVIDER_ERROR_FIXTURES.otpExpired),
    ).toBe(true);
  });

  it("동일 code라도 status가 다르면 OTP failure로 추정하지 않는다", () => {
    expect(
      isOtpValidityFailure({
        status: 500,
        code: "otp_expired",
      }),
    ).toBe(false);
  });

  it("Provider Rate Limit은 OTP validity failure가 아니다", () => {
    expect(
      isOtpValidityFailure(
        AUTH_PROVIDER_ERROR_FIXTURES.requestRateLimit,
      ),
    ).toBe(false);
  });
});

describe("Provider error message 독립성", () => {
  it("분류는 raw message가 달라져도 동일하다", () => {
    const first = {
      ...AUTH_PROVIDER_ERROR_FIXTURES.invalidCredentials,
      message: "Invalid login credentials",
    };

    const second = {
      ...AUTH_PROVIDER_ERROR_FIXTURES.invalidCredentials,
      message: "완전히 다른 Provider 메시지",
    };

    expect(isPasswordLoginCredentialFailure(first)).toBe(true);
    expect(isPasswordLoginCredentialFailure(second)).toBe(true);
  });

  it("OTP 분류도 raw message가 달라져도 동일하다", () => {
    const first = {
      ...AUTH_PROVIDER_ERROR_FIXTURES.otpExpired,
      message: "Token has expired or is invalid",
    };

    const second = {
      ...AUTH_PROVIDER_ERROR_FIXTURES.otpExpired,
      message: "different message",
    };

    expect(isOtpValidityFailure(first)).toBe(true);
    expect(isOtpValidityFailure(second)).toBe(true);
  });
});
