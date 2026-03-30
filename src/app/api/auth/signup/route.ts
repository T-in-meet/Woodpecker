import { NextRequest } from "next/server";

import { failureResponse, successResponse } from "@/lib/api/response";
import { checkSignupRateLimit } from "@/lib/auth/checkSignupRateLimit";
import { getUserByEmail } from "@/lib/auth/getUserByEmail";
import { AUTH_API_CODES } from "@/lib/constants/authApiCodes";
import { ROUTES } from "@/lib/constants/routes";
import { STORAGE_BUCKETS } from "@/lib/constants/storageBuckets";
import { createClient } from "@/lib/supabase/server";
import { mapSignupValidationErrors } from "@/lib/validation/auth/mapSignupValidationErrors";
import { signupApiSchema } from "@/lib/validation/auth/signupSchema";

async function parseRequest(
  request: NextRequest,
): Promise<{ body: unknown; avatarFile: File | null }> {
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
    const imageEntry = formData.get("avatarFile");
    const avatarFile = imageEntry instanceof File ? imageEntry : null;
    return { body, avatarFile };
  }

  const body = await request.json();
  return { body, avatarFile: null };
}

const ALLOWED_AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_AVATAR_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const MAX_AVATAR_SIZE_BYTES = 10 * 1024 * 1024;

function validateAvatarFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return (
    ALLOWED_AVATAR_MIME_TYPES.includes(file.type) &&
    ALLOWED_AVATAR_EXTENSIONS.includes(ext) &&
    file.size <= MAX_AVATAR_SIZE_BYTES
  );
}

async function uploadAvatar(
  supabase: Awaited<ReturnType<typeof createClient>>,
  avatarFile: File,
  userId: string,
): Promise<string | null> {
  if (!validateAvatarFile(avatarFile)) {
    console.warn("Invalid avatar file rejected");
    return null;
  }

  const ext = avatarFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const uploadPath = `${crypto.randomUUID()}.${ext}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKETS.AVATARS)
    .upload(uploadPath, avatarFile);

  if (uploadError || !uploadData) {
    console.error("Failed to upload avatar file", {
      userId,
      uploadError,
    });
    return null;
  }

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKETS.AVATARS)
    .getPublicUrl(uploadData.path);

  const avatarUrl = urlData.publicUrl;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl })
    .eq("id", userId);

  if (updateError) {
    const { error: removeError } = await supabase.storage
      .from(STORAGE_BUCKETS.AVATARS)
      .remove([uploadData.path]);

    if (removeError) {
      console.error("Failed to rollback uploaded avatar file", {
        userId,
        path: uploadData.path,
        updateError,
        removeError,
      });
    } else {
      console.warn("Rolled back uploaded avatar file after DB update failure", {
        userId,
        path: uploadData.path,
        updateError,
      });
    }

    return null;
  }

  return avatarUrl;
}

export async function POST(request: NextRequest) {
  // TODO: x-forwarded-for는 클라이언트가 임의 조작 가능 — Vercel Edge Config나 WAF를 통한 신뢰할 수 있는 IP 출처로 교체 필요
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";

  const { body, avatarFile } = await parseRequest(request);
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

  if (avatarFile && data.user) {
    avatarUrl = await uploadAvatar(supabase, avatarFile, data.user.id);
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
