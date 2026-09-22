import "server-only";

import { cookies } from "next/headers";

import { RESET_PASSWORD_PATH } from "../constants/routes";
import { RESET_PASSWORD_INTENT_TTL_SECONDS } from "./rate-limit/authRateLimitConstants";
import {
  createSignedIntent,
  type ResetPasswordIntentPayload,
  verifySignedIntent,
} from "./signedIntent";

export { type ResetPasswordIntentPayload } from "./signedIntent";

export const SIGNED_RESET_PASSWORD_INTENT_COOKIE = "reset_password_intent";

const RESET_PASSWORD_INTENT_PURPOSE = "reset-password" as const;

const RESET_PASSWORD_INTENT_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: RESET_PASSWORD_PATH,
};

type CreateResetPasswordIntentTokenParams = {
  userId: string;
  nowSeconds?: number;
};

type VerifyResetPasswordIntentParams = {
  token: string;
  expectedUserId: string;
  nowSeconds?: number;
};

type CreateSignedResetPasswordIntentParams = {
  userId: string;
  nowSeconds?: number;
};

/**
 * Reset Password 흐름에서 사용할 signed Intent token을 생성합니다.
 *
 * purpose는 reset-password로 고정하며 실제 signing과 TTL 계산은
 * 공통 Signed Intent 구현에 위임합니다.
 */
function createResetPasswordIntentToken({
  userId,
  nowSeconds,
}: CreateResetPasswordIntentTokenParams): string {
  return nowSeconds === undefined
    ? createSignedIntent({
        purpose: RESET_PASSWORD_INTENT_PURPOSE,
        userId,
      })
    : createSignedIntent({
        purpose: RESET_PASSWORD_INTENT_PURPOSE,
        userId,
        nowSeconds,
      });
}

/**
 * Reset Password Intent를 현재 사용자 기준으로 검증합니다.
 *
 * schema, signature, TTL, expiration 검증은 공통 verifier가 단일 신뢰 경계로
 * 소유하며 이 wrapper는 reset-password purpose와 user binding만 고정합니다.
 *
 * 기존 fixed-value `verified`는 signed Intent 형식을 충족하지 않으므로
 * 유효한 authorization proof로 인정하지 않습니다.
 */
export function verifyResetPasswordIntent({
  token,
  expectedUserId,
  nowSeconds,
}: VerifyResetPasswordIntentParams): ResetPasswordIntentPayload | null {
  return nowSeconds === undefined
    ? verifySignedIntent({
        token,
        expectedPurpose: RESET_PASSWORD_INTENT_PURPOSE,
        expectedUserId,
      })
    : verifySignedIntent({
        token,
        expectedPurpose: RESET_PASSWORD_INTENT_PURPOSE,
        expectedUserId,
        nowSeconds,
      });
}

/**
 * 현재 요청의 signed Reset Password Intent raw cookie 값을 읽습니다.
 *
 * 반환값은 아직 검증되지 않은 authorization proof이므로 server-side 경계
 * 안에서만 전달하고 로그, client props, 사용자 응답에 노출하지 않습니다.
 */
export async function readSignedResetPasswordIntent(): Promise<string | null> {
  const cookieStore = await cookies();

  return cookieStore.get(SIGNED_RESET_PASSWORD_INTENT_COOKIE)?.value ?? null;
}

/**
 * signed Reset Password Intent를 생성해 전용 HttpOnly cookie에 저장합니다.
 *
 * payload TTL과 cookie Max-Age는 동일한 Reset Password Intent 정책 상수를
 * 사용해 두 수명이 서로 달라지지 않도록 유지합니다.
 */
export async function createSignedResetPasswordIntent({
  userId,
  nowSeconds,
}: CreateSignedResetPasswordIntentParams): Promise<void> {
  const token =
    nowSeconds === undefined
      ? createResetPasswordIntentToken({ userId })
      : createResetPasswordIntentToken({ userId, nowSeconds });

  const cookieStore = await cookies();

  cookieStore.set(SIGNED_RESET_PASSWORD_INTENT_COOKIE, token, {
    ...RESET_PASSWORD_INTENT_COOKIE_OPTIONS,
    maxAge: RESET_PASSWORD_INTENT_TTL_SECONDS,
  });
}

/**
 * 동일한 cookie identity를 사용해 signed Reset Password Intent를 만료시킵니다.
 */
export async function clearSignedResetPasswordIntent(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SIGNED_RESET_PASSWORD_INTENT_COOKIE, "", {
    ...RESET_PASSWORD_INTENT_COOKIE_OPTIONS,
    maxAge: 0,
  });
}
