import { describe, expect, it } from "vitest";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { isRateLimitError } from "@/features/auth/errors/rateLimitError";

describe("isRateLimitError — rate limit 에러 판별", () => {
  describe("rate limit 에러로 판별되는 경우", () => {
    it("SIGNUP_RATE_LIMIT_EXCEEDED 코드는 rate limit 에러로 판별한다", () => {
      expect(
        isRateLimitError({ code: AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED }),
      ).toBe(true);
    });

    it("RESEND_RATE_LIMIT_EXCEEDED 코드는 rate limit 에러로 판별한다", () => {
      expect(
        isRateLimitError({ code: AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED }),
      ).toBe(true);
    });

    it("LOGIN_RATE_LIMIT_EXCEEDED 코드는 rate limit 에러로 판별한다", () => {
      // login rate limit 응답을 클라이언트에서 처리하기 위해 판별 대상에 포함해야 한다
      expect(
        isRateLimitError({ code: AUTH_API_CODES.LOGIN_RATE_LIMIT_EXCEEDED }),
      ).toBe(true);
    });
  });

  describe("rate limit 에러로 판별되지 않는 경우", () => {
    it("null은 rate limit 에러가 아니다", () => {
      expect(isRateLimitError(null)).toBe(false);
    });

    it("undefined는 rate limit 에러가 아니다", () => {
      expect(isRateLimitError(undefined)).toBe(false);
    });

    it("문자열은 rate limit 에러가 아니다", () => {
      expect(isRateLimitError("error")).toBe(false);
    });

    it("code 필드가 없는 객체는 rate limit 에러가 아니다", () => {
      expect(isRateLimitError({ message: "something" })).toBe(false);
    });

    it("LOGIN_INVALID_CREDENTIALS 코드는 rate limit 에러가 아니다", () => {
      expect(
        isRateLimitError({ code: AUTH_API_CODES.LOGIN_INVALID_CREDENTIALS }),
      ).toBe(false);
    });

    it("LOGIN_INTERNAL_ERROR 코드는 rate limit 에러가 아니다", () => {
      expect(
        isRateLimitError({ code: AUTH_API_CODES.LOGIN_INTERNAL_ERROR }),
      ).toBe(false);
    });
  });
});
