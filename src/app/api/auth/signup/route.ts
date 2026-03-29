import { NextRequest } from "next/server";

import { failureResponse, successResponse } from "@/lib/api/response";
import { checkSignupRateLimit } from "@/lib/auth/checkSignupRateLimit";
import { getUserByEmail } from "@/lib/auth/getUserByEmail";
import { AUTH_API_CODES } from "@/lib/constants/authApiCodes";
import { ROUTES } from "@/lib/constants/routes";
import { createClient } from "@/lib/supabase/server";
import { mapSignupValidationErrors } from "@/lib/validation/auth/mapSignupValidationErrors";
import { signupApiSchema } from "@/lib/validation/auth/signupSchema";

async function parseRequest(
  request: NextRequest,
): Promise<{ body: unknown; profileImage: File | null }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const agreementsRaw = formData.get("agreements");
    let agreements: unknown = null;
    try {
      agreements =
        typeof agreementsRaw === "string" ? JSON.parse(agreementsRaw) : null;
    } catch {
      agreements = null;
    }
    const body = {
      email: formData.get("email"),
      password: formData.get("password"),
      nickname: formData.get("nickname"),
      agreements,
    };
    const imageEntry = formData.get("profileImage");
    const profileImage = imageEntry instanceof File ? imageEntry : null;
    return { body, profileImage };
  }

  const body = await request.json();
  return { body, profileImage: null };
}

async function uploadAvatar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profileImage: File,
  userId: string,
): Promise<string | null> {
  const ext = profileImage.name.split(".").pop() ?? "jpg";
  const uploadPath = `avatars/${crypto.randomUUID()}.${ext}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(uploadPath, profileImage);

  if (uploadError || !uploadData) {
    return null;
  }

  const { data: urlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(uploadData.path);

  const avatarUrl = urlData.publicUrl;

  await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId);

  return avatarUrl;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  const { body, profileImage } = await parseRequest(request);
  const parsed = signupApiSchema.safeParse(body);

  if (!parsed.success) {
    return failureResponse(AUTH_API_CODES.SIGNUP_INVALID_INPUT, {
      errors: mapSignupValidationErrors(parsed.error, body),
    });
  }

  const { email, password, nickname } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const rateLimit = await checkSignupRateLimit(ip, normalizedEmail);
  if (!rateLimit.allowed) {
    return failureResponse(AUTH_API_CODES.SIGNUP_RATE_LIMIT_EXCEEDED);
  }

  const existingUser = await getUserByEmail(normalizedEmail);

  if (existingUser && existingUser.email_confirmed_at === null) {
    return successResponse(
      AUTH_API_CODES.SIGNUP_SUCCESS,
      { email: normalizedEmail, status: "PENDING" },
      { status: 200 },
    );
  }

  if (existingUser && existingUser.email_confirmed_at !== null) {
    return successResponse(
      AUTH_API_CODES.SIGNUP_SUCCESS,
      { email: normalizedEmail, redirectTo: ROUTES.LOGIN },
      { status: 200 },
    );
  }

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

  let avatarUrl: string | null = null;

  if (profileImage && data.user) {
    avatarUrl = await uploadAvatar(supabase, profileImage, data.user.id);
  }

  return successResponse(
    AUTH_API_CODES.SIGNUP_SUCCESS,
    {
      email: data.user?.email ?? normalizedEmail,
      ...(avatarUrl !== null ? { avatar_url: avatarUrl } : {}),
      redirectTo: ROUTES.VERIFY_EMAIL,
    },
    { status: 201 },
  );
}
