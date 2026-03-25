"use server";

import { redirect } from "next/navigation";

import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { changePasswordSchema, profileSchema } from "./schema";

export async function updateProfileAction(
  _prevState: unknown,
  formData: FormData,
) {
  const parsed = profileSchema.safeParse({
    nickname: formData.get("nickname"),
    avatarUrl: formData.get("avatarUrl"),
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
      avatar_url: parsed.data.avatarUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    return { error: "프로필 업데이트에 실패했습니다" };
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
