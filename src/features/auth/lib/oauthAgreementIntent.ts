import { NextRequest, NextResponse } from "next/server";

export const OAUTH_AGREEMENT_INTENT_COOKIE = "oauth_agreement_intent";

const COOKIE_VALUE = "accepted";

export function setOAuthAgreementIntentCookie(response: NextResponse) {
  response.cookies.set(OAUTH_AGREEMENT_INTENT_COOKIE, COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });
}

export function hasOAuthAgreementIntentCookie(request: NextRequest): boolean {
  return (
    request.cookies.get(OAUTH_AGREEMENT_INTENT_COOKIE)?.value === COOKIE_VALUE
  );
}

export function clearOAuthAgreementIntentCookie(response: NextResponse) {
  response.cookies.set(OAUTH_AGREEMENT_INTENT_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
}
