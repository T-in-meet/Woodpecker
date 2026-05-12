"use server";

import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import {
  AVATAR_ALLOWED_TYPES,
  AVATAR_MAX_SIZE,
  changePasswordSchema,
  profileSchema,
} from "./schema";

export async function updateProfileAction(
  _prevState: unknown,
  formData: FormData,
) {
  const parsed = profileSchema.safeParse({
    nickname: formData.get("nickname"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다" };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({
      nickname: parsed.data.nickname,
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    return { error: "프로필 업데이트에 실패했습니다" };
  }

  return { data };
}

export async function uploadAvatarAction(
  _prevState: unknown,
  formData: FormData,
) {
  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "파일을 선택해주세요" };
  }

  if (!(AVATAR_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return { error: "JPG, PNG, GIF, WebP 형식만 업로드 가능합니다" };
  }

  if (file.size > AVATAR_MAX_SIZE) {
    return { error: "파일 크기는 5MB 이하여야 합니다" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "인증이 필요합니다" };

  const path = `${user.id}/avatar`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { error: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

  const { data, error } = await supabase
    .from("profiles")
    .update({
      avatar_url: cacheBustedUrl,
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) return { error: "프로필 업데이트에 실패했습니다" };

  return { data };
}

export async function deleteAvatarAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "인증이 필요합니다" };

  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id)
    .select()
    .single();

  if (error) return { error: "아바타 삭제에 실패했습니다" };

  const { error: removeError } = await supabase.storage
    .from("avatars")
    .remove([`${user.id}/avatar`]);

  if (removeError) {
    console.error("아바타 파일 삭제 실패:", removeError.message);
  }

  return { data };
}

export async function changePasswordAction(
  _prevState: unknown,
  formData: FormData,
) {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmNewPassword: formData.get("confirmNewPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: "인증이 필요합니다" };
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });

  if (signInError) {
    return { error: "인증 정보가 올바르지 않습니다" };
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (updateError) {
    return { error: "비밀번호 변경에 실패했습니다" };
  }

  return { data: { success: true as const } };
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(ROUTES.LOGIN);
}

export async function deleteAccountAction() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다" };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(user.id);

  if (error) {
    return { error: "계정 삭제에 실패했습니다" };
  }

  await supabase.auth.signOut();
  redirect(ROUTES.LOGIN);
}
