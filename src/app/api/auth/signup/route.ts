import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { API_CODES } from "@/lib/constants/apiCodes";
import { createClient } from "@/lib/supabase/server";

const signupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  nickname: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = signupRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, code: "INVALID_INPUT", data: null },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/login`,
    },
  });

  if (error) {
    return NextResponse.json(
      { success: false, code: error.code ?? "SIGNUP_FAILED", data: null },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      success: true,
      code: API_CODES.SIGNUP_SUCCESS,
      data: { email: data.user?.email ?? normalizedEmail },
    },
    { status: 201 },
  );
}
