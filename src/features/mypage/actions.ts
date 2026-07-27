"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getKstDayBoundsUtc } from "@/features/review/lib/kstDay";
import { ROUTES } from "@/lib/constants/routes";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import {
  AVATAR_ALLOWED_TYPES,
  AVATAR_MAX_SIZE,
  changePasswordSchema,
  FEEDBACK_DAILY_LIMIT_MESSAGE,
  FEEDBACK_IMAGE_ALLOWED_TYPES,
  FEEDBACK_IMAGE_MAX_COUNT,
  FEEDBACK_IMAGE_MAX_SIZE,
  feedbackSchema,
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

  if (uploadError) {
    console.error("[uploadAvatarAction] supabase upload failed:", uploadError);
    return { error: "이미지 업로드에 실패했습니다" };
  }

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

// ---- 피드백 (#266) ----

async function removeFeedbackImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paths: string[],
) {
  if (paths.length === 0) return;

  const { error } = await supabase.storage.from("feedbacks").remove(paths);
  if (error) {
    console.error("[feedback] 이미지 정리 실패:", error.message);
  }
}

export async function createFeedbackAction(
  _prevState: unknown,
  formData: FormData,
) {
  const noteIdRaw = formData.get("noteId");
  const parsed = feedbackSchema.safeParse({
    category: formData.get("category"),
    title: formData.get("title"),
    content: formData.get("content"),
    noteId:
      typeof noteIdRaw === "string" && noteIdRaw !== "" ? noteIdRaw : null,
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const images = formData
    .getAll("images")
    .filter((file): file is File => file instanceof File && file.size > 0);

  if (images.length > FEEDBACK_IMAGE_MAX_COUNT) {
    return {
      error: `이미지는 최대 ${FEEDBACK_IMAGE_MAX_COUNT}장까지 첨부할 수 있습니다`,
    };
  }

  for (const file of images) {
    if (
      !(FEEDBACK_IMAGE_ALLOWED_TYPES as readonly string[]).includes(file.type)
    ) {
      return { error: "JPG, PNG, GIF, WebP 형식만 업로드 가능합니다" };
    }
    if (file.size > FEEDBACK_IMAGE_MAX_SIZE) {
      return { error: "이미지 크기는 장당 5MB 이하여야 합니다" };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다" };
  }

  // 하루 1개 사전 체크 — 동시 요청 경합은 unique index가 최종적으로 막는다
  const { startUtcIso, endUtcIso } = getKstDayBoundsUtc(new Date());
  const { data: todayRows, error: todayError } = await supabase
    .from("feedbacks")
    .select("id")
    .eq("user_id", user.id)
    .gte("created_at", startUtcIso)
    .lt("created_at", endUtcIso)
    .limit(1);

  if (todayError) {
    console.error("[createFeedbackAction] 일일 제한 조회 실패:", todayError);
    return { error: "문의사항 제출에 실패했습니다" };
  }

  if (todayRows.length > 0) {
    return { error: FEEDBACK_DAILY_LIMIT_MESSAGE };
  }

  // 스토리지 경로에 feedback id가 필요하므로 insert 전에 미리 생성한다
  const feedbackId = crypto.randomUUID();
  const uploadedPaths: string[] = [];

  for (const file of images) {
    const ext = file.type.split("/")[1] ?? "bin";
    const path = `${user.id}/${feedbackId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("feedbacks")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      console.error("[createFeedbackAction] 업로드 실패:", uploadError);
      await removeFeedbackImages(supabase, uploadedPaths);
      return { error: "이미지 업로드에 실패했습니다" };
    }

    uploadedPaths.push(path);
  }

  const { data, error } = await supabase
    .from("feedbacks")
    .insert({
      id: feedbackId,
      user_id: user.id,
      note_id: parsed.data.noteId,
      category: parsed.data.category,
      title: parsed.data.title,
      content: parsed.data.content,
      image_urls: uploadedPaths,
    })
    .select()
    .single();

  if (error) {
    await removeFeedbackImages(supabase, uploadedPaths);

    // 23505: unique_violation — 사전 체크를 통과한 동시 요청이 인덱스에 걸린 경우
    if (error.code === "23505") {
      return { error: FEEDBACK_DAILY_LIMIT_MESSAGE };
    }

    console.error("[createFeedbackAction] insert 실패:", error);
    return { error: "문의사항 제출에 실패했습니다" };
  }

  return { data };
}

export async function deleteFeedbackAction(feedbackId: string) {
  if (!z.string().uuid().safeParse(feedbackId).success) {
    return { error: "잘못된 요청입니다" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "인증이 필요합니다" };
  }

  // RLS(feedbacks_delete_own_before_reply)가 답변 달린 피드백의 삭제를 막는다.
  // 정책에 걸리면 에러 없이 0건 삭제로 끝나므로 반환 행 유무로 판별한다.
  const { data: deleted, error } = await supabase
    .from("feedbacks")
    .delete()
    .eq("id", feedbackId)
    .eq("user_id", user.id)
    .select("id, image_urls");

  if (error) {
    console.error("[deleteFeedbackAction] 삭제 실패:", error);
    return { error: "문의사항 삭제에 실패했습니다" };
  }

  const deletedRow = deleted?.[0];
  if (!deletedRow) {
    return {
      error:
        "삭제할 수 없습니다. 답변이 등록되었거나 이미 삭제된 문의사항입니다",
    };
  }

  await removeFeedbackImages(supabase, deletedRow.image_urls);

  return { data: { success: true as const } };
}
