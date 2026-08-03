import { cookies } from "next/headers";

export const RESET_PASSWORD_INTENT_COOKIE = "reset_password_intent";

const COOKIE_VALUE = "verified";
const COOKIE_MAX_AGE_SECONDS = 60 * 15;

/**
 * reset-password 접근을 허용하는 짧은 수명의 intent cookie를 설정합니다.
 */
export async function setResetPasswordIntentCookie(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(RESET_PASSWORD_INTENT_COOKIE, COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/reset-password",
  });
}

/**
 * reset-password intent cookie가 유효한지 확인합니다.
 *
 * @returns reset-password 접근 허용 cookie가 있으면 true
 */
export async function hasResetPasswordIntentCookie(): Promise<boolean> {
  const cookieStore = await cookies();

  return cookieStore.get(RESET_PASSWORD_INTENT_COOKIE)?.value === COOKIE_VALUE;
}

/**
 * reset-password 완료 또는 거부 후 intent cookie를 삭제합니다.
 */
export async function clearResetPasswordIntentCookie(): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(RESET_PASSWORD_INTENT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/reset-password",
  });
}
