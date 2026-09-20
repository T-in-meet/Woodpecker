import "server-only";

import { cookies } from "next/headers";

import { ROUTES } from "@/lib/constants/routes";

import { SET_PASSWORD_PATH } from "../constants/routes";
import { SET_PASSWORD_INTENT_TTL_SECONDS } from "./rate-limit/authRateLimitConstants";
import {
  createSignedIntent,
  type SetPasswordIntentPayload,
  verifySignedIntent,
} from "./signedIntent";
import { validateRedirectPath } from "./validateRedirectPath";

export { type SetPasswordIntentPayload } from "./signedIntent";

export const SET_PASSWORD_INTENT_COOKIE = "set_password_intent";
export const SET_PASSWORD_INTENT_MAX_TOKEN_BYTES = 3_800;

const SET_PASSWORD_INTENT_PURPOSE = "signup-set-password" as const;

const SET_PASSWORD_INTENT_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: SET_PASSWORD_PATH,
};

type CreateSetPasswordIntentTokenParams = {
  userId: string;
  redirectPath?: unknown;
  nowSeconds?: number;
};

type VerifySetPasswordIntentParams = {
  token: string;
  expectedUserId: string;
  nowSeconds?: number;
};

type CreateSetPasswordIntentParams = {
  userId: string;
  redirectPath?: unknown;
  nowSeconds?: number;
};

/**
 * 정규화가 끝난 Set Password destination을 포함해 signed Intent token을 생성합니다.
 *
 * purpose는 signup-set-password로 고정하며 실제 signing과 TTL 계산은
 * 공통 Signed Intent 구현에 위임합니다.
 */
function signSetPasswordIntent({
  userId,
  redirectPath,
  nowSeconds,
}: {
  userId: string;
  redirectPath: string;
  nowSeconds?: number;
}): string {
  return nowSeconds === undefined
    ? createSignedIntent({
        purpose: SET_PASSWORD_INTENT_PURPOSE,
        userId,
        redirectPath,
      })
    : createSignedIntent({
        purpose: SET_PASSWORD_INTENT_PURPOSE,
        userId,
        redirectPath,
        nowSeconds,
      });
}

/**
 * Set Password Intent 발급의 최종 trust boundary입니다.
 *
 * caller가 전달한 redirect를 validateRedirectPath()로 다시 정규화하고,
 * 최종 serialized token의 UTF-8 byte 길이를 cookie-safe budget 안으로 제한합니다.
 * budget을 초과하면 MYPAGE destination으로 재서명하며, fallback token조차
 * budget을 넘으면 configuration/system error로 실패합니다.
 */
function createSetPasswordIntentToken({
  userId,
  redirectPath,
  nowSeconds,
}: CreateSetPasswordIntentTokenParams): string {
  const normalizedRedirectPath = validateRedirectPath(redirectPath);
  const token =
    nowSeconds === undefined
      ? signSetPasswordIntent({
          userId,
          redirectPath: normalizedRedirectPath,
        })
      : signSetPasswordIntent({
          userId,
          redirectPath: normalizedRedirectPath,
          nowSeconds,
        });

  if (Buffer.byteLength(token, "utf8") <= SET_PASSWORD_INTENT_MAX_TOKEN_BYTES) {
    return token;
  }

  const fallbackToken =
    nowSeconds === undefined
      ? signSetPasswordIntent({
          userId,
          redirectPath: ROUTES.MYPAGE,
        })
      : signSetPasswordIntent({
          userId,
          redirectPath: ROUTES.MYPAGE,
          nowSeconds,
        });

  if (
    Buffer.byteLength(fallbackToken, "utf8") >
    SET_PASSWORD_INTENT_MAX_TOKEN_BYTES
  ) {
    throw new Error("Set Password Intent exceeds the cookie-safe size budget");
  }

  return fallbackToken;
}

/**
 * Set Password Intent를 현재 사용자 기준으로 검증합니다.
 *
 * exact schema, signature, TTL, expiration 검증은 공통 verifier가 단일 신뢰 경계로
 * 소유하며 이 wrapper는 signup-set-password purpose와 user binding을 고정합니다.
 */
export function verifySetPasswordIntent({
  token,
  expectedUserId,
  nowSeconds,
}: VerifySetPasswordIntentParams): SetPasswordIntentPayload | null {
  return nowSeconds === undefined
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
 * redirectPath는 이 함수 내부에서 다시 검증·정규화되어 signed claim으로 저장되며,
 * payload TTL과 cookie Max-Age는 동일한 Set Password 정책 상수를 사용합니다.
 */
export async function createSetPasswordIntent({
  userId,
  redirectPath,
  nowSeconds,
}: CreateSetPasswordIntentParams): Promise<void> {
  const token =
    nowSeconds === undefined
      ? createSetPasswordIntentToken({
          userId,
          redirectPath,
        })
      : createSetPasswordIntentToken({
          userId,
          redirectPath,
          nowSeconds,
        });
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
