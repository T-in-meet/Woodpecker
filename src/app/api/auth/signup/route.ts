import { NextRequest } from "next/server";

import { AUTH_API_CODES } from "@/features/auth/constants/authApiCodes";
import { getUserByEmail } from "@/features/auth/lib/getUserByEmail";
import { failureResponse, successResponse } from "@/features/auth/lib/response";
import { checkSignupRateLimit } from "@/features/auth/signup/lib/checkSignupRateLimit";
import { mapSignupValidationErrors } from "@/features/auth/signup/lib/mapSignupValidationErrors";
import { signupApiSchema } from "@/features/auth/signup/schema/signupApiSchema";
import {
  ALLOWED_AVATAR_EXTENSIONS,
  ALLOWED_AVATAR_MIME_TYPES,
  MAX_AVATAR_SIZE_BYTES,
} from "@/lib/constants/profiles";
import { ROUTES } from "@/lib/constants/routes";
import { STORAGE_BUCKETS } from "@/lib/constants/storageBuckets";
import { createClient } from "@/lib/supabase/server";
import { getClientIp } from "@/lib/utils/getClientIp";
import { VALIDATION_REASON } from "@/lib/validation/reasons";

class JsonParseError extends Error {}

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new JsonParseError();
  }
  return { body, avatarFile: null };
}

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
  const ip = getClientIp(request);

  let body: unknown;
  let avatarFile: File | null;
  try {
    ({ body, avatarFile } = await parseRequest(request));
  } catch (e) {
    if (e instanceof JsonParseError) {
      return failureResponse(AUTH_API_CODES.SIGNUP_INVALID_INPUT, {
        errors: [{ field: "body", reason: VALIDATION_REASON.INVALID_FORMAT }],
      });
    }
    throw e;
  }

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
      {
        email: normalizedEmail,
        redirectTo: ROUTES.LOGIN,
        signupAccountStatus: "pending",
      },
      { status: 200 },
    );
  }

  if (existingUser && existingUser.email_confirmed_at !== null) {
    return successResponse(
      AUTH_API_CODES.SIGNUP_SUCCESS,
      {
        email: normalizedEmail,
        redirectTo: ROUTES.LOGIN,
        signupAccountStatus: "active",
      },
      { status: 200 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}${ROUTES.LOGIN}`,
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
      redirectTo: ROUTES.LOGIN,
      signupAccountStatus: "pending",
    },
    { status: 201 },
  );
}
