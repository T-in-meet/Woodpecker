import { NextResponse } from "next/server";

import { clearSignedResetPasswordIntent } from "@/features/auth/lib/signedResetPasswordIntent";
import { ROUTES } from "@/lib/constants/routes";

export async function GET(request: Request) {
  await clearSignedResetPasswordIntent();

  return NextResponse.redirect(new URL(ROUTES.MYPAGE, request.url));
}
