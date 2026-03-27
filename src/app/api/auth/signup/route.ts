import { NextRequest } from "next/server";

import { failureResponse, successResponse } from "@/lib/api/response";
import { AUTH_API_CODES } from "@/lib/constants/authApiCodes";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";
import { mapSignupValidationErrors } from "@/lib/validation/auth/mapSignupValidationErrors";
import { signupApiSchema } from "@/lib/validation/auth/signupSchema";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = signupApiSchema.safeParse(body);

  if (!parsed.success) {
    return failureResponse(AUTH_API_CODES.SIGNUP_INVALID_INPUT, {
      errors: mapSignupValidationErrors(parsed.error, body),
    });
  }

  const { email, password, nickname } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}${ROUTES.LOGIN}`,
      data: { nickname },
    },
  });

  if (error) {
    return failureResponse(AUTH_API_CODES.SIGNUP_INVALID_INPUT, {
      status: 400,
    });
  }

  return successResponse(
    AUTH_API_CODES.SIGNUP_SUCCESS,
    { email: data.user?.email ?? normalizedEmail },
    { status: 201 },
  );
}
