import { NextResponse } from "next/server";

import { clearSetPasswordIntent } from "@/features/auth/lib/setPasswordIntent";
import { ROUTES } from "@/lib/constants/routes";

export async function GET(request: Request) {
  await clearSetPasswordIntent();

  return NextResponse.redirect(new URL(ROUTES.MYPAGE, request.url));
}
