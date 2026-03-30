import { NextRequest } from "next/server";
import { z } from "zod";

import { failureResponse, successResponse } from "@/lib/api/response";
import { checkResendRateLimit } from "@/lib/auth/checkResendRateLimit";
import { getLastVerificationResendAt } from "@/lib/auth/getLastVerificationResendAt";
import { resendVerificationEmail } from "@/lib/auth/resendVerificationEmail";
import { setLastVerificationResendAt } from "@/lib/auth/setLastVerificationResendAt";
import { AUTH_API_CODES } from "@/lib/constants/authApiCodes";

const RESEND_COOLDOWN_MS = 60 * 1000;

const resendSchema = z.object({
  email: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.email()),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = resendSchema.safeParse(body);

  if (!parsed.success) {
    return failureResponse(AUTH_API_CODES.RESEND_INVALID_INPUT, {
      status: 400,
    });
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  const lastResendAt = await getLastVerificationResendAt(normalizedEmail);
  const now = Date.now();

  if (lastResendAt !== null && now - lastResendAt < RESEND_COOLDOWN_MS) {
    return failureResponse(
      AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_COOLDOWN_CONFLICT,
    );
  }

  const rateLimit = await checkResendRateLimit(normalizedEmail);
  if (!rateLimit.allowed) {
    return failureResponse(AUTH_API_CODES.RESEND_RATE_LIMIT_EXCEEDED);
  }

  await resendVerificationEmail(normalizedEmail);
  await setLastVerificationResendAt(normalizedEmail, now);

  return successResponse(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS, {
    email: normalizedEmail,
    resent: true,
  });
}
