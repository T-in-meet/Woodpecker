import { describe, expect, it } from "vitest";

import {
  getBlockedAuthPageRedirectPath,
  isAuthAccessControlledPath,
  isGuestOnlyAuthPath,
  isSessionRequiredAuthPath,
} from "@/features/auth/utils/authPageAccessPolicy";
import { ROUTES } from "@/lib/constants/routes";

describe("authPageAccessPolicy", () => {
  describe("isGuestOnlyAuthPath", () => {
    it.each([
      ROUTES.SIGNUP,
      ROUTES.LOGIN,
      ROUTES.VERIFY_EMAIL,
      ROUTES.FORGOT_PASSWORD,
    ])("%s는 guest-only auth path로 판단한다", (pathname) => {
      expect(isGuestOnlyAuthPath(pathname)).toBe(true);
    });

    it.each([ROUTES.RESET_PASSWORD, ROUTES.HOME, "/notes"])(
      "%s는 guest-only auth path가 아니다",
      (pathname) => {
        expect(isGuestOnlyAuthPath(pathname)).toBe(false);
      },
    );
  });

  describe("isSessionRequiredAuthPath", () => {
    it("reset-password는 session-required auth path로 판단한다", () => {
      expect(isSessionRequiredAuthPath(ROUTES.RESET_PASSWORD)).toBe(true);
    });

    it.each([
      ROUTES.SIGNUP,
      ROUTES.LOGIN,
      ROUTES.VERIFY_EMAIL,
      ROUTES.FORGOT_PASSWORD,
      ROUTES.HOME,
      "/notes",
    ])("%s는 session-required auth path가 아니다", (pathname) => {
      expect(isSessionRequiredAuthPath(pathname)).toBe(false);
    });
  });

  describe("isAuthAccessControlledPath", () => {
    it.each([
      ROUTES.SIGNUP,
      ROUTES.LOGIN,
      ROUTES.VERIFY_EMAIL,
      ROUTES.FORGOT_PASSWORD,
      ROUTES.RESET_PASSWORD,
    ])("%s는 auth 접근 제어 대상이다", (pathname) => {
      expect(isAuthAccessControlledPath(pathname)).toBe(true);
    });

    it.each([ROUTES.HOME, "/notes"])(
      "%s는 auth 접근 제어 대상이 아니다",
      (pathname) => {
        expect(isAuthAccessControlledPath(pathname)).toBe(false);
      },
    );
  });

  describe("getBlockedAuthPageRedirectPath", () => {
    it.each([
      ROUTES.SIGNUP,
      ROUTES.LOGIN,
      ROUTES.VERIFY_EMAIL,
      ROUTES.FORGOT_PASSWORD,
    ])("로그인 사용자가 %s에 접근하면 HOME으로 이동시킨다", (pathname) => {
      expect(
        getBlockedAuthPageRedirectPath({
          pathname,
          hasSession: true,
        }),
      ).toBe(ROUTES.HOME);
    });

    it.each([
      ROUTES.SIGNUP,
      ROUTES.LOGIN,
      ROUTES.VERIFY_EMAIL,
      ROUTES.FORGOT_PASSWORD,
    ])("비로그인 사용자가 %s에 접근하면 차단하지 않는다", (pathname) => {
      expect(
        getBlockedAuthPageRedirectPath({
          pathname,
          hasSession: false,
        }),
      ).toBeNull();
    });

    it("비로그인 사용자가 reset-password에 접근하면 forgot-password로 이동시킨다", () => {
      expect(
        getBlockedAuthPageRedirectPath({
          pathname: ROUTES.RESET_PASSWORD,
          hasSession: false,
        }),
      ).toBe(ROUTES.FORGOT_PASSWORD);
    });

    it("로그인 사용자가 reset-password에 접근하면 차단하지 않는다", () => {
      expect(
        getBlockedAuthPageRedirectPath({
          pathname: ROUTES.RESET_PASSWORD,
          hasSession: true,
        }),
      ).toBeNull();
    });

    it.each([
      { pathname: ROUTES.HOME, hasSession: true },
      { pathname: ROUTES.HOME, hasSession: false },
      { pathname: "/notes", hasSession: true },
      { pathname: "/notes", hasSession: false },
    ])("일반 경로는 차단하지 않는다: %o", ({ pathname, hasSession }) => {
      expect(
        getBlockedAuthPageRedirectPath({
          pathname,
          hasSession,
        }),
      ).toBeNull();
    });
  });
});
