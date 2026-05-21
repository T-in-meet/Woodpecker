import { NextRequest, NextResponse } from "next/server";

import { validateRedirectPath } from "@/features/auth/lib/validateRedirectPath";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase Auth Callback Route
 *
 * 현재 역할:
 * - OAuth callback 처리 전용
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");
  const redirectPath = validateRedirectPath(
    requestUrl.searchParams.get("redirect") ?? ROUTES.MYPAGE,
  );

  if (!code) {
    return NextResponse.redirect(new URL(ROUTES.LOGIN, requestUrl.origin));
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL(ROUTES.LOGIN, requestUrl.origin));
  }

  return NextResponse.redirect(new URL(redirectPath, requestUrl.origin));
}
