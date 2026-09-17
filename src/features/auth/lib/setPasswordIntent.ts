import "server-only";

import { cookies } from "next/headers";

import { SET_PASSWORD_PATH } from "../constants/routes";
import { SET_PASSWORD_INTENT_TTL_SECONDS } from "./rate-limit/authRateLimitConstants";
import {
  createSignedIntent,
  type SignedIntentPayload,
  verifySignedIntent,
} from "./signedIntent";

export const SET_PASSWORD_INTENT_COOKIE = "set_password_intent";

const SET_PASSWORD_INTENT_PURPOSE = "signup-set-password" as const;

const SET_PASSWORD_INTENT_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: SET_PASSWORD_PATH,
};

export type SetPasswordIntentPayload = SignedIntentPayload & {
  purpose: typeof SET_PASSWORD_INTENT_PURPOSE;
};

type CreateSetPasswordIntentTokenParams = {
  userId: string;
  nowSeconds?: number;
};

type VerifySetPasswordIntentParams = {
  token: string;
  expectedUserId: string;
  nowSeconds?: number;
};

type CreateSetPasswordIntentParams = {
  userId: string;
  nowSeconds?: number;
};

/**
 * Set Password 흐름에서 사용할 signed Intent token을 생성합니다.
 *
 * purpose는 signup-set-password로 고정하며 실제 signing과 TTL 계산은
 * 공통 Signed Intent 구현에 위임합니다.
 */
function createSetPasswordIntentToken({
  userId,
  nowSeconds,
}: CreateSetPasswordIntentTokenParams): string {
  return nowSeconds === undefined
    ? createSignedIntent({
        purpose: SET_PASSWORD_INTENT_PURPOSE,
        userId,
      })
    : createSignedIntent({
        purpose: SET_PASSWORD_INTENT_PURPOSE,
        userId,
        nowSeconds,
      });
}

/**
 * Set Password Intent를 현재 사용자 기준으로 검증합니다.
 *
 * schema, signature, TTL, expiration 검증은 공통 verifier가 단일 신뢰 경계로
 * 소유하며 이 wrapper는 purpose와 user binding만 고정합니다.
 */
export function verifySetPasswordIntent({
  token,
  expectedUserId,
  nowSeconds,
}: VerifySetPasswordIntentParams): SetPasswordIntentPayload | null {
  const payload =
    nowSeconds === undefined
      ? verifySignedIntent({
          token,
          expectedPurpose: SET_PASSWORD_INTENT_PURPOSE,
          expectedUserId,
        })
      : verifySignedIntent({
          token,
          expectedPurpose: SET_PASSWORD_INTENT_PURPOSE,
          expectedUserId,
          nowSeconds,
        });

  if (!payload) {
    return null;
  }

  return payload as SetPasswordIntentPayload;
}

/**
 * 현재 요청의 Set Password Intent raw cookie 값을 읽습니다.
 *
 * 반환값은 아직 검증되지 않은 authorization proof이므로 server-side 경계
 * 안에서만 전달하고 로그, client props, 사용자 응답에 노출하지 않습니다.
 */
export async function readSetPasswordIntent(): Promise<string | null> {
  const cookieStore = await cookies();

  return cookieStore.get(SET_PASSWORD_INTENT_COOKIE)?.value ?? null;
}

/**
 * Set Password Intent를 생성해 전용 HttpOnly cookie에 저장합니다.
 *
 * 실제 signing과 15분 payload TTL은 공통 Signed Intent 구현에 위임하고,
 * cookie Max-Age도 동일한 정책 상수를 사용합니다.
 */
export async function createSetPasswordIntent({
  userId,
  nowSeconds,
}: CreateSetPasswordIntentParams): Promise<void> {
  const token =
    nowSeconds === undefined
      ? createSetPasswordIntentToken({ userId })
      : createSetPasswordIntentToken({ userId, nowSeconds });
  const cookieStore = await cookies();

  cookieStore.set(SET_PASSWORD_INTENT_COOKIE, token, {
    ...SET_PASSWORD_INTENT_COOKIE_OPTIONS,
    maxAge: SET_PASSWORD_INTENT_TTL_SECONDS,
  });
}

/** 동일한 cookie identity를 사용해 Set Password Intent를 만료시킵니다. */
export async function clearSetPasswordIntent(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SET_PASSWORD_INTENT_COOKIE, "", {
    ...SET_PASSWORD_INTENT_COOKIE_OPTIONS,
    maxAge: 0,
  });
}
