import { NextRequest } from "next/server";
import { z } from "zod";

import { failureResponse, successResponse } from "@/lib/api/response";
import { AUTH_API_CODES } from "@/lib/constants/authApiCodes";
import { createClient } from "@/lib/supabase/server";

const resendSchema = z.object({
  email: z.preprocess((v) => (typeof v === "string" ? v.trim() : v), z.email()),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = resendSchema.safeParse(body);

  if (!parsed.success) {
    return failureResponse(AUTH_API_CODES.SIGNUP_INVALID_INPUT, {
      status: 400,
    });
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: normalizedEmail,
  });

  if (error) {
    return failureResponse(AUTH_API_CODES.SIGNUP_INVALID_INPUT, {
      status: 400,
    });
  }

  return successResponse(AUTH_API_CODES.EMAIL_VERIFICATION_RESEND_SUCCESS, {
    email: normalizedEmail,
    resent: true,
  });
}
