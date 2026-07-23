import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { setOAuthAgreementIntentCookie } from "@/features/auth/lib/oauthAgreementIntent";
import { failureResponse } from "@/lib/api/response";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

const oauthAgreementIntentSchema = z.object({
  agreements: z.object({
    termsOfService: z.literal(true),
    privacyPolicy: z.literal(true),
  }),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = oauthAgreementIntentSchema.safeParse(body);

  if (!parsed.success) {
    return failureResponse(
      AUTH_API_CODES.OAUTH_AGREEMENT_INTENT_INVALID_INPUT,
      {
        errors: [{ field: "agreements", reason: VALIDATION_REASON.NOT_AGREED }],
      },
    );
  }

  const response = NextResponse.json({
    success: true,
    code: AUTH_API_CODES.OAUTH_AGREEMENT_INTENT_SUCCESS,
    data: { ok: true },
  });

  setOAuthAgreementIntentCookie(response);

  return response;
}
